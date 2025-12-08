import React, { useState, useRef, DragEvent } from 'react';

const ImgikaTool: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [imageDragActive, setImageDragActive] = useState(false);
  const [dataDragActive, setDataDragActive] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dataInputRef = useRef<HTMLInputElement>(null);

  // Header 常量定义
  const HEADER_SIZE = 1068; // 总 header 大小
  const FILE_SIZE_OFFSET = 0;       // 0-7: 文件大小 (8字节)
  const ORIGINAL_WIDTH_OFFSET = 8;  // 8-11: 原始宽度 (4字节)
  const SHA256_OFFSET = 12;         // 12-43: SHA256 (32字节)
  const IMAGE_FILENAME_OFFSET = 44; // 44-555: 图片文件名 (512字节)
  const DATA_FILENAME_OFFSET = 556; // 556-1067: 数据文件名 (512字节)
  const FILENAME_MAX_LENGTH = 512;  // 文件名最大长度

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

  // 拖拽处理函数
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
    e. preventDefault();
    e.stopPropagation();
    setDataDragActive(false);
    
    if (isProcessing) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setDataFile(files[0]);
    }
  };

  // 计算SHA256
  const calculateSHA256 = async (data: Uint8Array): Promise<Uint8Array> => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
    return new Uint8Array(hashBuffer);
  };

  // 将字符串编码为固定长度的字节数组（UTF-8编码，不足部分填充0）
  const encodeFilename = (filename: string, maxLength: number): Uint8Array => {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(filename);
    const result = new Uint8Array(maxLength);
    // 复制文件名（截断如果太长）
    const copyLength = Math.min(encoded. length, maxLength - 1); // 留一个字节给结束符
    result.set(encoded.subarray(0, copyLength), 0);
    // 剩余部分已经是0（Uint8Array默认填充0）
    return result;
  };

  // 从字节数组解码文件名（UTF-8解码，遇到0结束）
  const decodeFilename = (bytes: Uint8Array): string => {
    // 找到第一个0字节的位置
    let endIndex = bytes.indexOf(0);
    if (endIndex === -1) {
      endIndex = bytes.length;
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes.subarray(0, endIndex));
  };

  // 加载图片并返回ImageData
  const loadImage = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片加载失败'));
      };
      img.src = url;
    });
  };

  const handleProcess = async () => {
    if (!imageFile) return;
    
    setIsProcessing(true);
    setProgress(0);
    
    try {
      if (mode === 'encode') {
        if (!dataFile) {
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
    if (!imageFile || !dataFile || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('无法获取 Canvas 上下文');
    
    setProgress(5);
    
    // 1. 加载图片
    const img = await loadImage(imageFile);
    const originalWidth = img.width;
    const originalHeight = img.height;
    const aspectRatio = originalWidth / originalHeight;
    
    setProgress(10);
    
    // 2. 读取要隐藏的二进制文件
    const fileBuffer = await dataFile.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    
    setProgress(15);
    
    // 3. 计算SHA256
    const sha256 = await calculateSHA256(fileBytes);
    
    setProgress(20);
    
    // 4. 计算所需空间
    // Header: 8字节(文件大小) + 4字节(原始宽度) + 32字节(SHA256) + 512字节(图片文件名) + 512字节(数据文件名) = 1068字节
    const totalBytesNeeded = HEADER_SIZE + fileBytes.length;
    
    // 5. 计算保持宽高比的最小尺寸
    // w * h >= totalBytesNeeded
    // w / h = aspectRatio
    // h = sqrt(totalBytesNeeded / aspectRatio)
    let finalHeight = Math.ceil(Math.sqrt(totalBytesNeeded / aspectRatio));
    let finalWidth = Math.ceil(finalHeight * aspectRatio);
    
    // 确保总像素数足够
    while (finalWidth * finalHeight < totalBytesNeeded) {
      finalHeight++;
      finalWidth = Math.ceil(finalHeight * aspectRatio);
    }
    
    // 6. 如果原图已经足够大，使用原图尺寸
    if (originalWidth * originalHeight >= totalBytesNeeded) {
      finalWidth = originalWidth;
      finalHeight = originalHeight;
    }
    
    setProgress(25);
    console.log(`原始尺寸: ${originalWidth}x${originalHeight}`);
    console.log(`最终尺寸: ${finalWidth}x${finalHeight}`);
    console.log(`需要像素: ${totalBytesNeeded}, 可用像素: ${finalWidth * finalHeight}`);
    console.log(`图片文件名: ${imageFile.name}`);
    console.log(`数据文件名: ${dataFile.name}`);
    
    // 7.  设置画布并绘制放大后的图片
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    
    // 绘制原图到新尺寸（可能会拉伸）
    ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
    
    setProgress(30);
    
    // 8. 获取像素数据
    const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
    const pixels = imageData.data;
    
    // 9. 构建header数据 (1068字节)
    const header = new ArrayBuffer(HEADER_SIZE);
    const headerView = new DataView(header);
    const headerBytes = new Uint8Array(header);
    
    // 0-7: 文件大小 (8字节, 小端序)
    headerView.setBigUint64(FILE_SIZE_OFFSET, BigInt(fileBytes.length), true);
    
    // 8-11: 原始图片宽度 (4字节, 小端序)
    headerView.setUint32(ORIGINAL_WIDTH_OFFSET, originalWidth, true);
    
    // 12-43: SHA256校验和 (32字节)
    headerBytes.set(sha256, SHA256_OFFSET);
    
    // 44-555: 原始图片文件名 (512字节)
    const imageFilenameBytes = encodeFilename(imageFile.name, FILENAME_MAX_LENGTH);
    headerBytes.set(imageFilenameBytes, IMAGE_FILENAME_OFFSET);
    
    // 556-1067: 二进制数据原始文件名 (512字节)
    const dataFilenameBytes = encodeFilename(dataFile.name, FILENAME_MAX_LENGTH);
    headerBytes. set(dataFilenameBytes, DATA_FILENAME_OFFSET);
    
    setProgress(40);
    
    // 10. 合并header和文件数据
    const combinedData = new Uint8Array(HEADER_SIZE + fileBytes.length);
    combinedData.set(headerBytes, 0);
    combinedData.set(fileBytes, HEADER_SIZE);
    
    // 11. 写入Alpha通道
    // 按从上到下，从左到右的顺序（这是ImageData的默认顺序）
    const totalPixels = finalWidth * finalHeight;
    for (let i = 0; i < totalPixels; i++) {
      const pixelIndex = i * 4; // 每个像素占4个字节 (R, G, B, A)
      
      if (i < combinedData.length) {
        // 写入数据到Alpha通道
        pixels[pixelIndex + 3] = combinedData[i];
      } else {
        // 剩余像素的Alpha通道设为255（完全不透明）
        pixels[pixelIndex + 3] = 255;
      }
      
      // 更新进度
      if (i % 50000 === 0) {
        setProgress(40 + Math.round((i / totalPixels) * 50));
      }
    }
    
    setProgress(90);
    
    // 12. 更新画布
    ctx.putImageData(imageData, 0, 0);
    
    setProgress(95);
    
    // 13. 导出为PNG
    const resultDataUrl = canvas.toDataURL('image/png');
    setProcessedImage(resultDataUrl);
    
    setProgress(100);
    
    alert(`文件编码成功！\n原始尺寸: ${originalWidth}x${originalHeight}\n编码后尺寸: ${finalWidth}x${finalHeight}\n隐藏数据大小: ${fileBytes.length} 字节\n图片文件名: ${imageFile.name}\n数据文件名: ${dataFile.name}\n请下载生成的图片。`);
  };

  const decodeData = async () => {
    if (! imageFile || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('无法获取 Canvas 上下文');
    
    setProgress(5);
    
    // 1.  加载图片
    const img = await loadImage(imageFile);
    
    setProgress(15);
    
    // 2. 绘制到画布
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    setProgress(25);
    
    // 3. 获取像素数据
    const imageData = ctx.getImageData(0, 0, img. width, img.height);
    const pixels = imageData.data;
    const totalPixels = img.width * img.height;
    
    // 4. 读取header (1068字节)
    if (totalPixels < HEADER_SIZE) {
      throw new Error('图片太小，不是有效的IMGika图片');
    }
    
    const headerBytes = new Uint8Array(HEADER_SIZE);
    for (let i = 0; i < HEADER_SIZE; i++) {
      headerBytes[i] = pixels[i * 4 + 3]; // 读取每个像素的Alpha通道
    }
    
    setProgress(35);
    
    // 5. 解析header
    const headerView = new DataView(headerBytes. buffer);
    
    // 0-7: 文件大小
    const fileSize = Number(headerView.getBigUint64(FILE_SIZE_OFFSET, true));
    
    // 8-11: 原始图片宽度
    const originalWidth = headerView.getUint32(ORIGINAL_WIDTH_OFFSET, true);
    
    // 12-43: SHA256校验和
    const storedSHA256 = headerBytes.slice(SHA256_OFFSET, SHA256_OFFSET + 32);
    
    // 44-555: 原始图片文件名
    const imageFilenameBytes = headerBytes.slice(IMAGE_FILENAME_OFFSET, IMAGE_FILENAME_OFFSET + FILENAME_MAX_LENGTH);
    const originalImageFilename = decodeFilename(imageFilenameBytes) || 'original_image.png';
    
    // 556-1067: 二进制数据原始文件名
    const dataFilenameBytes = headerBytes.slice(DATA_FILENAME_OFFSET, DATA_FILENAME_OFFSET + FILENAME_MAX_LENGTH);
    const originalDataFilename = decodeFilename(dataFilenameBytes) || 'extracted_file.bin';
    
    console.log('解析header:');
    console.log('文件大小:', fileSize);
    console.log('原始宽度:', originalWidth);
    console.log('SHA256:', Array.from(storedSHA256).map(b => b.toString(16).padStart(2, '0')).join(''));
    console.log('原始图片文件名:', originalImageFilename);
    console. log('原始数据文件名:', originalDataFilename);
    
    // 6. 验证文件大小
    const maxFileSize = totalPixels - HEADER_SIZE;
    if (fileSize <= 0 || fileSize > maxFileSize) {
      throw new Error(`无效的文件大小 (${fileSize})，可能不是有效的IMGika图片。最大可存储: ${maxFileSize} 字节`);
    }
    
    setProgress(45);
    
    // 7. 提取文件数据
    const fileData = new Uint8Array(fileSize);
    for (let i = 0; i < fileSize; i++) {
      const pixelIndex = (i + HEADER_SIZE) * 4;
      fileData[i] = pixels[pixelIndex + 3]; // 读取Alpha通道
      
      // 更新进度
      if (i % 50000 === 0) {
        setProgress(45 + Math.round((i / fileSize) * 35));
      }
    }
    
    setProgress(80);
    
    // 8. 验证SHA256
    const calculatedSHA256 = await calculateSHA256(fileData);
    
    let sha256Match = true;
    for (let i = 0; i < 32; i++) {
      if (storedSHA256[i] !== calculatedSHA256[i]) {
        sha256Match = false;
        break;
      }
    }
    
    console.log('计算的SHA256:', Array.from(calculatedSHA256).map(b => b.toString(16).padStart(2, '0')).join(''));
    console.log('SHA256校验:', sha256Match ? '通过' : '失败');
    
    if (!sha256Match) {
      console.warn('SHA256校验失败，数据可能已损坏');
      if (! confirm('SHA256校验失败，数据可能已损坏。是否继续下载？')) {
        throw new Error('SHA256校验失败，用户取消下载');
      }
    }
    
    setProgress(85);
    
    // 9. 下载提取的文件（使用原始文件名）
    const blob = new Blob([fileData]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = originalDataFilename; // 使用从header中提取的原始文件名
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setProgress(90);
    
    // 10. 恢复原始RGB图片
    // 计算原始高度（根据宽高比）
    const currentAspectRatio = img.width / img.height;
    const originalHeight = Math.round(originalWidth / currentAspectRatio);
    
    console.log(`恢复原始图片尺寸: ${originalWidth}x${originalHeight}`);
    
    // 创建原始尺寸的画布
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = originalWidth;
    originalCanvas.height = originalHeight;
    const originalCtx = originalCanvas.getContext('2d');
    
    if (originalCtx) {
      // 将编码后的图片缩放回原始尺寸
      originalCtx.drawImage(img, 0, 0, originalWidth, originalHeight);
      
      // 获取像素数据并设置Alpha为255（完全不透明）
      const originalImageData = originalCtx.getImageData(0, 0, originalWidth, originalHeight);
      const originalPixels = originalImageData.data;
      
      for (let i = 0; i < originalPixels.length; i += 4) {
        originalPixels[i + 3] = 255; // 设置Alpha为完全不透明
      }
      
      originalCtx.putImageData(originalImageData, 0, 0);
      
      // 下载原始图片（使用从header中提取的原始文件名）
      // 确保文件扩展名为.png（因为我们输出的是PNG格式）
      let outputImageFilename = originalImageFilename;
      const lastDotIndex = outputImageFilename.lastIndexOf('.');
      if (lastDotIndex > 0) {
        outputImageFilename = outputImageFilename.substring(0, lastDotIndex) + '.png';
      } else {
        outputImageFilename = outputImageFilename + '.png';
      }
      
      originalCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = outputImageFilename; // 使用从header中提取的原始图片文件名
          document. body.appendChild(a);
          a.click();
          document. body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    }
    
    setProgress(100);
    
    alert(`文件解码成功！\n- 隐藏的文件已下载为 "${originalDataFilename}" (${fileSize} 字节)\n- 原始图片已下载为 "${originalImageFilename. replace(/\.[^. ]+$/, '. png')}" (${originalWidth}x${originalHeight})\nSHA256校验: ${sha256Match ? '通过 ✓' : '失败 ✗'}`);
  };

  const resetAll = () => {
    setImageFile(null);
    setDataFile(null);
    setProcessedImage(null);
    setProgress(0);
    setImageDragActive(false);
    setDataDragActive(false);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    if (dataInputRef.current) {
      dataInputRef.current.value = '';
    }
  };

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
                  {(imageFile.size / 1024).toFixed(2)} KB
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
                    {(dataFile.size / 1024).toFixed(2)} KB
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
          disabled={isProcessing || ! imageFile || (mode === 'encode' && ! dataFile)}
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
          <div className="w-full max-w-md mt-4 bg-[var(--md-sys-color-surface)] rounded-full h-2. 5 overflow-hidden">
            <div
              className="bg-[var(--md-sys-color-primary)] h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}
        
        {! isProcessing && (imageFile || dataFile || processedImage) && (
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
            <div className="mt-4 flex justify-center">
              <a
                href={processedImage}
                download="imgika_encoded.png"
                className="px-6 py-3 rounded-full bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] font-medium flex items-center gap-2 hover:shadow-xl transition-shadow"
              >
                <span>⬇</span>
                下载编码后的图片
              </a>
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
              <p>• 选择要隐藏的文件（任意格式）</p>
              <p>• 处理后会生成一张PNG图片，包含隐藏的数据</p>
              <p>• 数据格式（Header 1068字节）：</p>
              <p className="pl-4">- 0-7字节：文件大小</p>
              <p className="pl-4">- 8-11字节：原始图片宽度</p>
              <p className="pl-4">- 12-43字节：SHA256校验和</p>
              <p className="pl-4">- 44-555字节：原始图片文件名</p>
              <p className="pl-4">- 556-1067字节：隐藏文件原始文件名</p>
              <p>• 如果原图太小，会自动调整到能容纳数据的最小尺寸（保持宽高比）</p>
            </>
          ) : (
            <>
              <p>• <strong>解码模式</strong>：从编码后的图片中提取隐藏的文件</p>
              <p>• 上传使用IMGika编码的PNG图片</p>
              <p>• 会自动提取并下载隐藏的文件（使用原始文件名）</p>
              <p>• 同时会恢复并下载原始的RGB图片（使用原始文件名）</p>
              <p>• 会自动验证SHA256校验和以确保数据完整性</p>
            </>
          )}
        </div>
      </div>
      
      {/* 隐藏的Canvas元素 */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ImgikaTool;