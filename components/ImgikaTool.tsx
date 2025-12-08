import React, { useState, useRef, DragEvent, useCallback, useEffect } from 'react';

// Worker 代码作为字符串
const workerCode = `
const HEADER_SIZE = 1068;
const FILE_SIZE_OFFSET = 0;
const ORIGINAL_WIDTH_OFFSET = 8;
const SHA256_OFFSET = 12;
const IMAGE_FILENAME_OFFSET = 44;
const DATA_FILENAME_OFFSET = 556;
const FILENAME_MAX_LENGTH = 512;

// 计算SHA256
async function calculateSHA256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// 编码文件名
function encodeFilename(filename, maxLength) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(filename);
  const result = new Uint8Array(maxLength);
  const copyLength = Math.min(encoded.length, maxLength - 1);
  result.set(encoded.subarray(0, copyLength), 0);
  return result;
}

// 解码文件名
function decodeFilename(bytes) {
  let endIndex = bytes.indexOf(0);
  if (endIndex === -1) endIndex = bytes.length;
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(bytes.subarray(0, endIndex));
}

// 分块处理函数
async function processChunked(totalIterations, chunkSize, processFunc, progressCallback) {
  let processed = 0;
  while (processed < totalIterations) {
    const end = Math.min(processed + chunkSize, totalIterations);
    await processFunc(processed, end);
    processed = end;
    if (progressCallback) {
      progressCallback(processed / totalIterations);
    }
    // 让出控制权，防止阻塞
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

// 编码处理
async function encodeImage(imageData, imgWidth, imgHeight, fileData, imageFilename, dataFilename) {
  // 确保宽高是有效的正整数
  const originalWidth = Math.max(1, Math.floor(Number(imgWidth) || 1));
  const originalHeight = Math.max(1, Math.floor(Number(imgHeight) || 1));
  const aspectRatio = originalWidth / originalHeight;
  
  self.postMessage({ type: 'progress', progress: 10 });
  self.postMessage({ 
    type: 'log', 
    message: 'encodeImage called with width=' + originalWidth + ', height=' + originalHeight
  });
  
  // 计算SHA256
  const fileBytes = new Uint8Array(fileData);
  const sha256 = await calculateSHA256(fileBytes);
  
  self.postMessage({ type: 'progress', progress: 20 });
  
  // 计算所需空间
  const totalBytesNeeded = HEADER_SIZE + fileBytes.length;
  
  // 计算保持宽高比的最小尺寸
  let finalHeight = Math.max(1, Math.ceil(Math.sqrt(totalBytesNeeded / aspectRatio)));
  let finalWidth = Math.max(1, Math.ceil(finalHeight * aspectRatio));
  
  // 确保是整数
  finalWidth = Math.floor(finalWidth);
  finalHeight = Math.floor(finalHeight);
  
  while (finalWidth * finalHeight < totalBytesNeeded) {
    finalHeight++;
    finalWidth = Math.max(1, Math.floor(Math.ceil(finalHeight * aspectRatio)));
  }
  
  // 如果原图已经足够大，使用原图尺寸
  if (originalWidth * originalHeight >= totalBytesNeeded) {
    finalWidth = originalWidth;
    finalHeight = originalHeight;
  }
  
  // 再次确保是有效的正整数
  finalWidth = Math.max(1, Math.floor(finalWidth));
  finalHeight = Math.max(1, Math.floor(finalHeight));
  
  self.postMessage({ type: 'progress', progress: 25 });
  self.postMessage({ 
    type: 'log', 
    message: 'Original: ' + originalWidth + 'x' + originalHeight + ', Final: ' + finalWidth + 'x' + finalHeight
  });
  
  // 创建 OffscreenCanvas
  let canvas;
  try {
    canvas = new OffscreenCanvas(finalWidth, finalHeight);
  } catch (e) {
    throw new Error('Failed to create OffscreenCanvas: width=' + finalWidth + ', height=' + finalHeight + ', error=' + e.message);
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context');
  }
  
  // 创建 ImageBitmap 并绘制
  const blob = new Blob([new Uint8Array(imageData)], { type: 'image/png' });
  const imageBitmap = await createImageBitmap(blob);
  ctx.drawImage(imageBitmap, 0, 0, finalWidth, finalHeight);
  imageBitmap.close();
  
  self.postMessage({ type: 'progress', progress: 35 });
  
  // 获取像素数据
  const resultImageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
  const pixels = resultImageData.data;
  
  // 构建header
  const header = new ArrayBuffer(HEADER_SIZE);
  const headerView = new DataView(header);
  const headerBytes = new Uint8Array(header);
  
  headerView.setBigUint64(FILE_SIZE_OFFSET, BigInt(fileBytes.length), true);
  headerView.setUint32(ORIGINAL_WIDTH_OFFSET, originalWidth, true);
  headerBytes.set(sha256, SHA256_OFFSET);
  headerBytes.set(encodeFilename(imageFilename, FILENAME_MAX_LENGTH), IMAGE_FILENAME_OFFSET);
  headerBytes.set(encodeFilename(dataFilename, FILENAME_MAX_LENGTH), DATA_FILENAME_OFFSET);
  
  // 合并数据
  const combinedData = new Uint8Array(HEADER_SIZE + fileBytes.length);
  combinedData.set(headerBytes, 0);
  combinedData.set(fileBytes, HEADER_SIZE);
  
  self.postMessage({ type: 'progress', progress: 40 });
  
  // 分块写入Alpha通道
  const totalPixels = finalWidth * finalHeight;
  const CHUNK_SIZE = 100000;
  
  await processChunked(totalPixels, CHUNK_SIZE, async (start, end) => {
    for (let i = start; i < end; i++) {
      const pixelIndex = i * 4;
      if (i < combinedData.length) {
        pixels[pixelIndex + 3] = combinedData[i];
      } else {
        pixels[pixelIndex + 3] = 255;
      }
    }
  }, (progress) => {
    self.postMessage({ type: 'progress', progress: 40 + Math.round(progress * 50) });
  });
  
  ctx.putImageData(resultImageData, 0, 0);
  
  self.postMessage({ type: 'progress', progress: 95 });
  
  // 转换为Blob
  const resultBlob = await canvas.convertToBlob({ type: 'image/png' });
  const arrayBuffer = await resultBlob.arrayBuffer();
  
  self.postMessage({ type: 'progress', progress: 100 });
  
  return {
    data: new Uint8Array(arrayBuffer),
    originalWidth,
    originalHeight,
    finalWidth,
    finalHeight,
    fileSize: fileBytes.length,
    imageFilename,
    dataFilename
  };
}

// 解码处理
async function decodeImage(imageData) {
  self.postMessage({ type: 'progress', progress: 5 });
  
  // 创建 ImageBitmap
  const blob = new Blob([new Uint8Array(imageData)], { type: 'image/png' });
  const imageBitmap = await createImageBitmap(blob);
  
  const width = Math.max(1, Math.floor(imageBitmap.width));
  const height = Math.max(1, Math.floor(imageBitmap.height));
  
  self.postMessage({ type: 'progress', progress: 15 });
  self.postMessage({ type: 'log', message: 'Decoding image: ' + width + 'x' + height });
  
  // 创建 OffscreenCanvas
  let canvas;
  try {
    canvas = new OffscreenCanvas(width, height);
  } catch (e) {
    imageBitmap.close();
    throw new Error('Failed to create OffscreenCanvas: width=' + width + ', height=' + height + ', error=' + e.message);
  }
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    imageBitmap.close();
    throw new Error('Failed to get 2d context');
  }
  
  ctx.drawImage(imageBitmap, 0, 0);
  imageBitmap.close();
  
  self.postMessage({ type: 'progress', progress: 25 });
  
  // 获取像素数据
  const resultImageData = ctx.getImageData(0, 0, width, height);
  const pixels = resultImageData.data;
  const totalPixels = width * height;
  
  if (totalPixels < HEADER_SIZE) {
    throw new Error('图片太小，不是有效的IMGika图片');
  }
  
  // 读取header
  const headerBytes = new Uint8Array(HEADER_SIZE);
  for (let i = 0; i < HEADER_SIZE; i++) {
    headerBytes[i] = pixels[i * 4 + 3];
  }
  
  self.postMessage({ type: 'progress', progress: 35 });
  
  // 解析header
  const headerView = new DataView(headerBytes.buffer);
  const fileSize = Number(headerView.getBigUint64(FILE_SIZE_OFFSET, true));
  const originalWidth = headerView.getUint32(ORIGINAL_WIDTH_OFFSET, true);
  const storedSHA256 = headerBytes.slice(SHA256_OFFSET, SHA256_OFFSET + 32);
  
  const imageFilenameBytes = headerBytes.slice(IMAGE_FILENAME_OFFSET, IMAGE_FILENAME_OFFSET + FILENAME_MAX_LENGTH);
  const originalImageFilename = decodeFilename(imageFilenameBytes) || 'original_image.png';
  
  const dataFilenameBytes = headerBytes.slice(DATA_FILENAME_OFFSET, DATA_FILENAME_OFFSET + FILENAME_MAX_LENGTH);
  const originalDataFilename = decodeFilename(dataFilenameBytes) || 'extracted_file.bin';
  
  self.postMessage({ 
    type: 'log', 
    message: 'File size: ' + fileSize + ', Original width: ' + originalWidth + ', Image filename: ' + originalImageFilename + ', Data filename: ' + originalDataFilename
  });
  
  // 验证文件大小
  const maxFileSize = totalPixels - HEADER_SIZE;
  if (fileSize <= 0 || fileSize > maxFileSize) {
    throw new Error('无效的文件大小 (' + fileSize + ')，可能不是有效的IMGika图片。最大可存储: ' + maxFileSize + ' 字节');
  }
  
  self.postMessage({ type: 'progress', progress: 45 });
  
  // 分块提取文件数据
  const fileData = new Uint8Array(fileSize);
  const CHUNK_SIZE = 100000;
  
  await processChunked(fileSize, CHUNK_SIZE, async (start, end) => {
    for (let i = start; i < end; i++) {
      const pixelIndex = (i + HEADER_SIZE) * 4;
      fileData[i] = pixels[pixelIndex + 3];
    }
  }, (progress) => {
    self.postMessage({ type: 'progress', progress: 45 + Math.round(progress * 30) });
  });
  
  self.postMessage({ type: 'progress', progress: 80 });
  
  // 验证SHA256
  const calculatedSHA256 = await calculateSHA256(fileData);
  let sha256Match = true;
  for (let i = 0; i < 32; i++) {
    if (storedSHA256[i] !== calculatedSHA256[i]) {
      sha256Match = false;
      break;
    }
  }
  
  self.postMessage({ type: 'progress', progress: 85 });
  
  // 恢复原始RGB图片
  const currentAspectRatio = width / height;
  const originalHeight = Math.max(1, Math.floor(Math.round(originalWidth / currentAspectRatio)));
  const safeOriginalWidth = Math.max(1, Math.floor(originalWidth));
  
  self.postMessage({ type: 'log', message: 'Restoring original image: ' + safeOriginalWidth + 'x' + originalHeight });
  
  let originalCanvas;
  try {
    originalCanvas = new OffscreenCanvas(safeOriginalWidth, originalHeight);
  } catch (e) {
    throw new Error('Failed to create original OffscreenCanvas: width=' + safeOriginalWidth + ', height=' + originalHeight + ', error=' + e.message);
  }
  
  const originalCtx = originalCanvas.getContext('2d');
  if (!originalCtx) {
    throw new Error('Failed to get original 2d context');
  }
  
  // 重新创建 ImageBitmap 用于缩放
  const blob2 = new Blob([new Uint8Array(imageData)], { type: 'image/png' });
  const imageBitmap2 = await createImageBitmap(blob2);
  originalCtx.drawImage(imageBitmap2, 0, 0, safeOriginalWidth, originalHeight);
  imageBitmap2.close();
  
  // 设置Alpha为255
  const originalImageData = originalCtx.getImageData(0, 0, safeOriginalWidth, originalHeight);
  const originalPixels = originalImageData.data;
  
  for (let i = 0; i < originalPixels.length; i += 4) {
    originalPixels[i + 3] = 255;
  }
  
  originalCtx.putImageData(originalImageData, 0, 0);
  
  const originalBlob = await originalCanvas.convertToBlob({ type: 'image/png' });
  const originalArrayBuffer = await originalBlob.arrayBuffer();
  
  self.postMessage({ type: 'progress', progress: 100 });
  
  // 处理输出文件名
  let outputImageFilename = originalImageFilename;
  const lastDotIndex = outputImageFilename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    outputImageFilename = outputImageFilename.substring(0, lastDotIndex) + '.png';
  } else {
    outputImageFilename = outputImageFilename + '.png';
  }
  
  return {
    fileData: fileData,
    originalImageData: new Uint8Array(originalArrayBuffer),
    originalDataFilename,
    outputImageFilename,
    fileSize,
    originalWidth: safeOriginalWidth,
    originalHeight,
    sha256Match
  };
}

// 消息处理
self.onmessage = async (e) => {
  const { type, payload } = e.data;
  
  try {
    if (type === 'encode') {
      const result = await encodeImage(
        payload.imageData,
        payload.imgWidth,
        payload.imgHeight,
        payload.fileData,
        payload.imageFilename,
        payload.dataFilename
      );
      self.postMessage({ type: 'encodeResult', result }, [result.data.buffer]);
    } else if (type === 'decode') {
      const result = await decodeImage(payload.imageData);
      self.postMessage({ 
        type: 'decodeResult', 
        result 
      }, [result.fileData.buffer, result.originalImageData.buffer]);
    }
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
`;

// 文件类型检测工具
const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot + 1).toLowerCase();
};

// 判断文件类型
type PreviewType = 'image' | 'video' | 'audio' | 'text' | 'code' | 'pdf' | 'none';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
const TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'log', 'csv', 'ini', 'cfg', 'conf'];
const CODE_EXTENSIONS = [
  'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'htm', 'css', 'scss', 'sass', 'less',
  'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php',
  'swift', 'kt', 'kts', 'scala', 'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
  'sql', 'xml', 'yaml', 'yml', 'toml', 'env', 'gitignore', 'dockerfile',
  'makefile', 'cmake', 'gradle', 'vue', 'svelte', 'astro'
];
const PDF_EXTENSIONS = ['pdf'];

const getPreviewType = (filename: string): PreviewType => {
  const ext = getFileExtension(filename);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  if (CODE_EXTENSIONS.includes(ext)) return 'code';
  if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
  return 'none';
};

const getMimeType = (filename: string): string => {
  const ext = getFileExtension(filename);
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'webp': 'image/webp', 'bmp': 'image/bmp',
    'svg': 'image/svg+xml', 'ico': 'image/x-icon',
    // Videos
    'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg',
    'mov': 'video/quicktime', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
    // Audio
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac',
    'aac': 'audio/aac', 'm4a': 'audio/mp4',
    // PDF
    'pdf': 'application/pdf',
    // Text/Code
    'txt': 'text/plain', 'md': 'text/markdown', 'json': 'application/json',
    'html': 'text/html', 'css': 'text/css', 'js': 'text/javascript',
    'xml': 'text/xml', 'csv': 'text/csv',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// 代码语言映射
const getCodeLanguage = (filename: string): string => {
  const ext = getFileExtension(filename);
  const langMap: Record<string, string> = {
    'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
    'py': 'python', 'java': 'java', 'c': 'c', 'cpp': 'cpp', 'h': 'c', 'hpp': 'cpp',
    'cs': 'csharp', 'go': 'go', 'rs': 'rust', 'rb': 'ruby', 'php': 'php',
    'swift': 'swift', 'kt': 'kotlin', 'scala': 'scala', 'sh': 'bash', 'bash': 'bash',
    'sql': 'sql', 'html': 'html', 'htm': 'html', 'css': 'css', 'scss': 'scss',
    'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown',
    'vue': 'vue', 'svelte': 'svelte',
  };
  return langMap[ext] || 'plaintext';
};

// 解码结果接口
interface DecodeResult {
  fileData: Uint8Array;
  originalImageData: Uint8Array;
  originalDataFilename: string;
  outputImageFilename: string;
  fileSize: number;
  originalWidth: number;
  originalHeight: number;
  sha256Match: boolean;
}

// 预览组件
interface FilePreviewProps {
  fileData: Uint8Array;
  filename: string;
  onClose: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ fileData, filename, onClose }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previewType = getPreviewType(filename);

  useEffect(() => {
    setIsLoading(true);
    
    if (previewType === 'image' || previewType === 'video' || previewType === 'audio' || previewType === 'pdf') {
      const blob = new Blob([fileData as BlobPart], { type: getMimeType(filename) });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsLoading(false);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (previewType === 'text' || previewType === 'code') {
      // 限制文本预览大小（最大1MB）
      const maxSize = 1024 * 1024;
      const dataToRead = fileData.length > maxSize ? fileData.slice(0, maxSize) : fileData;
      const decoder = new TextDecoder('utf-8');
      try {
        let content = decoder.decode(dataToRead);
        if (fileData.length > maxSize) {
          content += '\n\n...  (文件过大，仅显示前1MB内容)';
        }
        setTextContent(content);
      } catch {
        setTextContent('无法解码文本内容');
      }
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [fileData, filename, previewType]);

  if (previewType === 'none') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--md-sys-color-surface)] rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--md-sys-color-outline-variant)]/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {previewType === 'image' && '🖼️'}
              {previewType === 'video' && '🎬'}
              {previewType === 'audio' && '🎵'}
              {previewType === 'text' && '📄'}
              {previewType === 'code' && '💻'}
              {previewType === 'pdf' && '📑'}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-[var(--md-sys-color-on-surface)]">
                文件预览
              </h3>
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] break-all">
                {filename}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--md-sys-color-surface-variant)] transition-colors"
          >
            <span className="text-2xl">✕</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-4xl animate-spin">⟳</span>
            </div>
          ) : (
            <>
              {/* 图片预览 */}
              {previewType === 'image' && previewUrl && (
                <div className="flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt={filename}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
              )}

              {/* 视频预览 */}
              {previewType === 'video' && previewUrl && (
                <div className="flex items-center justify-center">
                  <video
                    src={previewUrl}
                    controls
                    className="max-w-full max-h-[70vh] rounded-lg"
                  >
                    您的浏览器不支持视频播放
                  </video>
                </div>
              )}

              {/* 音频预览 */}
              {previewType === 'audio' && previewUrl && (
                <div className="flex items-center justify-center py-8">
                  <audio src={previewUrl} controls className="w-full max-w-md">
                    您的浏览器不支持音频播放
                  </audio>
                </div>
              )}

              {/* PDF预览 */}
              {previewType === 'pdf' && previewUrl && (
                <div className="h-[70vh]">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full rounded-lg border border-[var(--md-sys-color-outline-variant)]/20"
                    title={filename}
                  />
                </div>
              )}

              {/* 文本预览 */}
              {previewType === 'text' && textContent !== null && (
                <div className="bg-[var(--md-sys-color-surface-variant)] rounded-lg p-4 overflow-auto max-h-[70vh]">
                  <pre className="text-sm text-[var(--md-sys-color-on-surface)] whitespace-pre-wrap break-words font-mono">
                    {textContent}
                  </pre>
                </div>
              )}

              {/* 代码预览 */}
              {previewType === 'code' && textContent !== null && (
                <div className="bg-[#1e1e1e] rounded-lg overflow-auto max-h-[70vh]">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#3d3d3d]">
                    <span className="text-xs text-gray-400 font-mono">
                      {getCodeLanguage(filename)}
                    </span>
                  </div>
                  <pre className="p-4 text-sm text-gray-200 whitespace-pre-wrap break-words font-mono overflow-x-auto">
                    <code>{textContent}</code>
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--md-sys-color-outline-variant)]/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-medium hover:shadow-lg transition-shadow"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

const ImgikaTool: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [processedImage, setProcessedImage] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [imageDragActive, setImageDragActive] = useState(false);
  const [dataDragActive, setDataDragActive] = useState(false);
  
  // 解码结果状态
  const [decodeResult, setDecodeResult] = useState<DecodeResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const processedImageUrlRef = useRef<string | null>(null);

  // 初始化 Worker
  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl);
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      URL.revokeObjectURL(workerUrl);
      if (processedImageUrlRef.current) {
        URL.revokeObjectURL(processedImageUrlRef.current);
      }
    };
  }, []);

  // 下载文件的辅助函数
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 延迟释放URL，确保下载开始
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  // 分块读取文件
  const readFileInChunks = useCallback(async (file: File, onProgress?: (progress: number) => void): Promise<Uint8Array> => {
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const totalSize = file.size;
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    
    while (loaded < totalSize) {
      const end = Math.min(loaded + CHUNK_SIZE, totalSize);
      const chunk = file.slice(loaded, end);
      const arrayBuffer = await chunk.arrayBuffer();
      chunks.push(new Uint8Array(arrayBuffer));
      loaded = end;
      if (onProgress) {
        onProgress(loaded / totalSize);
      }
    }
    
    // 合并所有块
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleDataUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDataFile(file);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>, type: 'image' | 'data') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'image') {
      setImageDragActive(true);
    } else {
      setDataDragActive(true);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>, type: 'image' | 'data') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'image') {
      setImageDragActive(false);
    } else {
      setDataDragActive(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDragActive(false);
    
    if (isProcessing) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setImageFile(file);
      } else {
        alert('请拖入图片文件');
      }
    }
  };

  const handleDataDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDataDragActive(false);
    
    if (isProcessing) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setDataFile(files[0]);
    }
  };

  // 获取图片尺寸
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('无法加载图片'));
      };
      img.src = url;
    });
  };

  const handleProcess = async () => {
    if (!imageFile || !workerRef.current) return;
    
    setIsProcessing(true);
    setProgress(0);
    setDecodeResult(null);
    setShowPreview(false);
    
    // 清理之前的处理结果
    if (processedImageUrlRef.current) {
      URL.revokeObjectURL(processedImageUrlRef.current);
      processedImageUrlRef.current = null;
    }
    setProcessedImage(null);
    
    try {
      if (mode === 'encode') {
        if (! dataFile) {
          throw new Error('请选择要隐藏的文件');
        }
        await encodeData();
      } else {
        await decodeData();
      }
    } catch (error) {
      console.error('处理过程中出现错误:', error);
      alert(`处理失败: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const encodeData = async () => {
    if (!imageFile || !dataFile || !workerRef.current) return;
    
    const worker = workerRef.current;
    
    // 读取图片尺寸
    const { width: imgWidth, height: imgHeight } = await getImageDimensions(imageFile);
    
    console.log('Image dimensions:', imgWidth, imgHeight);
    
    setProgress(2);
    
    // 分块读取图片文件
    const imageData = await readFileInChunks(imageFile, (p) => {
      setProgress(2 + Math.round(p * 3));
    });
    
    setProgress(5);
    
    // 分块读取数据文件
    const fileData = await readFileInChunks(dataFile, (p) => {
      setProgress(5 + Math.round(p * 5));
    });
    
    setProgress(10);
    
    return new Promise<void>((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        const { type, progress: workerProgress, result, error, message } = e.data;
        
        if (type === 'progress') {
          setProgress(workerProgress);
        } else if (type === 'log') {
          console.log('Worker:', message);
        } else if (type === 'encodeResult') {
          worker.removeEventListener('message', handleMessage);
          
          const blob = new Blob([result.data], { type: 'image/png' });
          setProcessedImage(blob);
          
          alert(`文件编码成功！\n原始尺寸: ${result.originalWidth}x${result.originalHeight}\n编码后尺寸: ${result.finalWidth}x${result.finalHeight}\n隐藏数据大小: ${result.fileSize} 字节\n图片文件名: ${result.imageFilename}\n数据文件名: ${result.dataFilename}\n请下载生成的图片。`);
          
          resolve();
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          reject(new Error(error));
        }
      };
      
      worker.addEventListener('message', handleMessage);
      
      // 创建新的 ArrayBuffer 副本以避免 detached buffer 问题
      const imageDataCopy = imageData.slice().buffer;
      const fileDataCopy = fileData.slice().buffer;
      
      // 发送数据到 Worker（使用 Transferable 避免复制）
      worker.postMessage({
        type: 'encode',
        payload: {
          imageData: imageDataCopy,
          imgWidth: Math.floor(imgWidth),
          imgHeight: Math.floor(imgHeight),
          fileData: fileDataCopy,
          imageFilename: imageFile.name,
          dataFilename: dataFile.name
        }
      }, [imageDataCopy, fileDataCopy]);
    });
  };

  const decodeData = async () => {
    if (!imageFile || !workerRef.current) return;
    
    const worker = workerRef.current;
    
    // 分块读取图片文件
    const imageData = await readFileInChunks(imageFile, (p) => {
      setProgress(Math.round(p * 5));
    });
    
    return new Promise<void>((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        const { type, progress: workerProgress, result, error, message } = e.data;
        
        if (type === 'progress') {
          setProgress(workerProgress);
        } else if (type === 'log') {
          console.log('Worker:', message);
        } else if (type === 'decodeResult') {
          worker.removeEventListener('message', handleMessage);
          
          // 保存解码结果用于预览
          setDecodeResult({
            fileData: new Uint8Array(result.fileData),
            originalImageData: new Uint8Array(result.originalImageData),
            originalDataFilename: result.originalDataFilename,
            outputImageFilename: result.outputImageFilename,
            fileSize: result.fileSize,
            originalWidth: result.originalWidth,
            originalHeight: result.originalHeight,
            sha256Match: result.sha256Match
          });
          
          // 检查是否可以预览
          const previewType = getPreviewType(result.originalDataFilename);
          if (previewType !== 'none') {
            setShowPreview(true);
          }
          
          // 下载提取的文件
          const fileBlob = new Blob([result.fileData]);
          downloadBlob(fileBlob, result.originalDataFilename);
          
          // 下载原始图片
          const imageBlob = new Blob([result.originalImageData], { type: 'image/png' });
          downloadBlob(imageBlob, result.outputImageFilename);
          
          alert(`文件解码成功！\n- 隐藏的文件已下载为 "${result.originalDataFilename}" (${result.fileSize} 字节)\n- 原始图片已下载为 "${result.outputImageFilename}" (${result.originalWidth}x${result.originalHeight})\nSHA256校验: ${result.sha256Match ? '通过 ✓' : '失败 ✗'}${previewType !== 'none' ?  '\n\n文件可预览，点击下方按钮查看预览' : ''}`);
          
          if (! result.sha256Match) {
            console.warn('SHA256校验失败，数据可能已损坏');
          }
          
          resolve();
        } else if (type === 'error') {
          worker.removeEventListener('message', handleMessage);
          reject(new Error(error));
        }
      };
      
      worker.addEventListener('message', handleMessage);
      
      // 创建新的 ArrayBuffer 副本
      const imageDataCopy = imageData.slice().buffer;
      
      worker.postMessage({
        type: 'decode',
        payload: {
          imageData: imageDataCopy
        }
      }, [imageDataCopy]);
    });
  };

  const handleDownload = useCallback(() => {
    if (processedImage) {
      downloadBlob(processedImage, 'imgika_encoded.png');
    }
  }, [processedImage, downloadBlob]);

  const resetAll = () => {
    setImageFile(null);
    setDataFile(null);
    setProcessedImage(null);
    setProgress(0);
    setImageDragActive(false);
    setDataDragActive(false);
    setDecodeResult(null);
    setShowPreview(false);
    if (processedImageUrlRef.current) {
      URL.revokeObjectURL(processedImageUrlRef.current);
      processedImageUrlRef.current = null;
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    if (dataInputRef.current) {
      dataInputRef.current.value = '';
    }
  };

  // 判断解码结果是否可预览
  const canPreview = decodeResult && getPreviewType(decodeResult.originalDataFilename) !== 'none';

  return (
    <div className="bg-[var(--md-sys-color-surface-container)] rounded-[32px] p-8 border border-[var(--md-sys-color-outline-variant)]/20">
      <h2 className="text-3xl font-bold mb-6 text-[var(--md-sys-color-on-surface)]">
        {mode === 'encode' ? '隐藏文件' : '提取文件'}
      </h2>
      
      <div className="flex gap-4 mb-6">
        <button
          className={`px-6 py-3 rounded-full font-medium transition-all ${
            mode === 'encode'
              ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]'
              : 'bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-variant)]'
          }`}
          onClick={() => {
            setMode('encode');
            resetAll();
          }}
          disabled={isProcessing}
        >
          编码模式
        </button>
        <button
          className={`px-6 py-3 rounded-full font-medium transition-all ${
            mode === 'decode'
              ? 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]'
              : 'bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-variant)]'
          }`}
          onClick={() => {
            setMode('decode');
            resetAll();
          }}
          disabled={isProcessing}
        >
          解码模式
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* 图片上传 */}
        <div className="bg-[var(--md-sys-color-surface)] p-6 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/20">
          <h3 className="text-xl font-semibold mb-4 text-[var(--md-sys-color-on-surface)]">
            {mode === 'encode' ? '1. 选择载体图片' : '1. 选择含数据的图片'}
          </h3>
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              imageDragActive 
                ? 'border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary)]/10' 
                : 'border-[var(--md-sys-color-outline)] hover:border-[var(--md-sys-color-primary)]'
            }`}
            onDragEnter={(e) => handleDragEnter(e, 'image')}
            onDragLeave={(e) => handleDragLeave(e, 'image')}
            onDragOver={handleDragOver}
            onDrop={handleImageDrop}
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              ref={imageInputRef}
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="text-4xl mb-2">
                {imageDragActive ? '📥' : '🖼️'}
              </div>
              <button
                className="px-6 py-3 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                onClick={() => imageInputRef.current?.click()}
                disabled={isProcessing}
              >
                选择图片
              </button>
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                或将图片拖拽到此区域
              </p>
            </div>
            {imageFile && (
              <div className="mt-4">
                <p className="text-[var(--md-sys-color-on-surface-variant)] break-all">
                  ✓ {imageFile.name}
                </p>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mt-1">
                  {(imageFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* 数据文件上传（仅编码模式） */}
        {mode === 'encode' && (
          <div className="bg-[var(--md-sys-color-surface)] p-6 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/20">
            <h3 className="text-xl font-semibold mb-4 text-[var(--md-sys-color-on-surface)]">
              2. 选择要隐藏的文件
            </h3>
            <div 
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dataDragActive 
                  ?  'border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary)]/10' 
                  : 'border-[var(--md-sys-color-outline)] hover:border-[var(--md-sys-color-primary)]'
              }`}
              onDragEnter={(e) => handleDragEnter(e, 'data')}
              onDragLeave={(e) => handleDragLeave(e, 'data')}
              onDragOver={handleDragOver}
              onDrop={handleDataDrop}
            >
              <input
                type="file"
                onChange={handleDataUpload}
                className="hidden"
                id="data-file-input"
                ref={dataInputRef}
                disabled={isProcessing}
              />
              <div className="flex flex-col items-center gap-3">
                <div className="text-4xl mb-2">
                  {dataDragActive ?  '📥' : '📄'}
                </div>
                <label
                  htmlFor="data-file-input"
                  className={`px-6 py-3 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] font-medium cursor-pointer inline-block hover:shadow-lg transition-shadow ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  选择文件
                </label>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  或将文件拖拽到此区域
                </p>
              </div>
              {dataFile && (
                <div className="mt-4">
                  <p className="text-[var(--md-sys-color-on-surface-variant)] break-all">
                    ✓ {dataFile.name}
                  </p>
                  <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mt-1">
                    {(dataFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 处理按钮 */}
      <div className="flex flex-col items-center">
        <button
          className={`px-8 py-4 rounded-full font-medium text-lg flex items-center gap-2 transition-all ${
            isProcessing
              ? 'bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)]'
              : 'bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:shadow-xl'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={handleProcess}
          disabled={isProcessing || !imageFile || (mode === 'encode' && ! dataFile)}
        >
          {isProcessing ? (
            <>
              <span className="animate-spin">⟳</span>
              处理中...  {progress}%
            </>
          ) : mode === 'encode' ? (
            '开始隐藏文件'
          ) : (
            '开始提取文件'
          )}
        </button>
        
        {isProcessing && (
          <div className="w-full max-w-md mt-4 bg-[var(--md-sys-color-surface)] rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[var(--md-sys-color-primary)] h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}
        
        {! isProcessing && (imageFile || dataFile || processedImage || decodeResult) && (
          <button
            className="mt-4 px-6 py-2 rounded-full bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] font-medium hover:bg-[var(--md-sys-color-surface-variant)] transition-colors"
            onClick={resetAll}
          >
            重置
          </button>
        )}
      </div>
      
      {/* 结果展示（仅编码模式） */}
      {mode === 'encode' && processedImage && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4 text-[var(--md-sys-color-on-surface)]">
            处理结果
          </h3>
          <div className="bg-[var(--md-sys-color-surface)] p-4 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/20">
            <div className="text-center text-[var(--md-sys-color-on-surface-variant)] mb-4">
              <p>文件大小: {(processedImage.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleDownload}
                className="px-6 py-3 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-medium flex items-center gap-2 hover:shadow-xl transition-shadow"
              >
                <span>⬇</span>
                下载编码后的图片
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 解码结果展示（仅解码模式） */}
      {mode === 'decode' && decodeResult && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4 text-[var(--md-sys-color-on-surface)]">
            解码结果
          </h3>
          <div className="bg-[var(--md-sys-color-surface)] p-6 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 提取的文件信息 */}
              <div className="space-y-2">
                <h4 className="font-medium text-[var(--md-sys-color-on-surface)]">📄 提取的文件</h4>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] break-all">
                  文件名: {decodeResult.originalDataFilename}
                </p>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  大小: {(decodeResult.fileSize / 1024 / 1024).toFixed(2)} MB ({decodeResult.fileSize} 字节)
                </p>
                <p className={`text-sm ${decodeResult.sha256Match ?  'text-green-500' : 'text-red-500'}`}>
                  SHA256校验: {decodeResult.sha256Match ? '通过 ✓' : '失败 ✗'}
                </p>
              </div>
              
              {/* 原始图片信息 */}
              <div className="space-y-2">
                <h4 className="font-medium text-[var(--md-sys-color-on-surface)]">🖼️ 原始图片</h4>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] break-all">
                  文件名: {decodeResult.outputImageFilename}
                </p>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  尺寸: {decodeResult.originalWidth}x{decodeResult.originalHeight}
                </p>
              </div>
            </div>
            
            {/* 预览按钮 */}
            {canPreview && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setShowPreview(true)}
                  className="px-6 py-3 rounded-full bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)] font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
                >
                  <span>👁️</span>
                  预览提取的文件
                </button>
              </div>
            )}
            
            {/* 重新下载按钮 */}
            <div className="mt-4 flex justify-center gap-4 flex-wrap">
              <button
                onClick={() => {
                  const fileBlob = new Blob([decodeResult.fileData as BlobPart]);
                  downloadBlob(fileBlob, decodeResult.originalDataFilename);
                }}
                className="px-6 py-3 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
              >
                <span>⬇</span>
                重新下载文件
              </button>
              <button
                onClick={() => {
                  const imageBlob = new Blob([decodeResult.originalImageData as BlobPart], { type: 'image/png' });
                  downloadBlob(imageBlob, decodeResult.outputImageFilename);
                }}
                className="px-6 py-3 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
              >
                <span>⬇</span>
                重新下载图片
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 说明文档 */}
      <div className="mt-8 bg-[var(--md-sys-color-surface)] p-6 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/20">
        <h3 className="text-lg font-semibold mb-3 text-[var(--md-sys-color-on-surface)]">
          使用说明
        </h3>
        <div className="text-sm text-[var(--md-sys-color-on-surface-variant)] space-y-2">
          {mode === 'encode' ? (
            <>
              <p>• <strong>编码模式</strong>：将任意文件隐藏到图片的Alpha通道中</p>
              <p>• 上传一张RGB图片作为载体（支持PNG/JPG/WebP等格式）</p>
              <p>• 选择要隐藏的文件（任意格式，支持较大文件）</p>
              <p>• 处理后会生成一张PNG图片，包含隐藏的数据</p>
              <p>• 数据格式（Header 1068字节）：</p>
                            <p className="pl-4">- 0-7字节：文件大小</p>
              <p className="pl-4">- 8-11字节：原始图片宽度</p>
              <p className="pl-4">- 12-43字节：SHA256校验和</p>
              <p className="pl-4">- 44-555字节：原始图片文件名</p>
              <p className="pl-4">- 556-1067字节：隐藏文件原始文件名</p>
              <p>• 如果原图太小，会自动调整到能容纳数据的最小尺寸（保持宽高比）</p>
              <p>• <strong>优化说明</strong>：使用 Web Worker 处理，支持较大文件的快速编码</p>
            </>
          ) : (
            <>
              <p>• <strong>解码模式</strong>：从编码后的图片中提取隐藏的文件</p>
              <p>• 上传使用IMGika编码的PNG图片</p>
              <p>• 会自动提取并下载隐藏的文件（使用原始文件名）</p>
              <p>• 同时会恢复并下载原始的RGB图片（使用原始文件名）</p>
              <p>• 会自动验证SHA256校验和以确保数据完整性</p>
              <p>• <strong>文件预览</strong>：支持预览以下类型的文件：</p>
              <p className="pl-4">- 图片：JPG, PNG, GIF, WebP, SVG, BMP 等</p>
              <p className="pl-4">- 视频：MP4, WebM, OGG, MOV 等</p>
              <p className="pl-4">- 音频：MP3, WAV, FLAC, AAC 等</p>
              <p className="pl-4">- 文本：TXT, MD, LOG, CSV 等</p>
              <p className="pl-4">- 代码：JS, TS, PY, JAVA, C, GO, RS, JSON, HTML, CSS 等</p>
              <p className="pl-4">- 文档：PDF</p>
              <p>• <strong>优化说明</strong>：使用 Web Worker 处理，支持较大文件的快速解码</p>
            </>
          )}
        </div>
      </div>

      {/* 文件预览弹窗 */}
      {showPreview && decodeResult && (
        <FilePreview
          fileData={decodeResult.fileData}
          filename={decodeResult.originalDataFilename}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default ImgikaTool;