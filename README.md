# IMGika - 图片隐写工具

IMGika 是一个基于 Web 的前端工具，可以在浏览器中将任何文件隐藏在图片的 Alpha 通道中，实现隐写术的功能。所有处理都在本地完成，确保您的数据隐私和安全。

## 功能特点

* **隐写功能**: 将任意文件隐藏在图片的 Alpha 通道中
* **完全本地处理**: 所有操作都在浏览器中完成，无需上传文件到服务器
* **无损图片质量**: 使用 PNG 格式保证图片质量不受影响
* **安全可靠**: 数据不会离开您的设备，保障隐私安全
* **Material You 设计**: 采用现代化的 Material Design 3 设计语言
* **深色/浅色模式**: 自动适配系统主题或手动切换
* **响应式设计**: 适配各种屏幕尺寸和设备

## 技术栈

* **前端框架**: React (v19.2.0)
* **语言**: TypeScript (v5.9.3)
* **构建工具**: Vite (v7.2.4)
* **样式**: Tailwind CSS
* **动画**: CSS 和自定义动画效果
* **图像处理**: Canvas API

## 项目结构

```
.
├── App.tsx                 # 应用主入口
├── config.ts               # 全局配置文件
├── index.css               # 全局样式
├── index.html              # HTML 模板
├── index.tsx               # React 渲染入口
├── package.json            # 依赖和脚本配置
├── pnpm-lock.yaml          # pnpm 锁定文件
├── tailwind.config.js      # Tailwind CSS 配置
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 配置
├── components/             # UI 组件目录
│   ├── Footer.tsx          # 页脚组件
│   ├── Hero.tsx            # 主页头部介绍组件
│   ├── HowItWorksSection.tsx # 工作原理说明组件
│   ├── ImgikaTool.tsx      # 核心隐写工具组件
│   └── ScrollReveal.tsx    # 滚动动画组件
└── public/                 # 静态资源目录
    └── favicon.ico         # 网站图标
```

## 核心组件说明

### Hero 组件
展示 IMGika 工具的介绍信息和核心特性，包括：
- 工具名称和描述
- 核心功能点（隐私保护、无损质量、安全可靠）
- 视觉展示区域

### ImgikaTool 组件
这是应用的核心功能组件，提供编码和解码功能：
- **编码模式**: 将文件隐藏在图片中
- **解码模式**: 从处理后的图片中提取原始文件
- 文件上传和处理流程
- 进度显示和结果展示

### HowItWorksSection 组件
以可视化方式展示工具的工作流程：
1. 上传文件（选择图片和需要隐藏的文件）
2. 编码处理（将文件数据隐藏在图片的 Alpha 通道中）
3. 下载结果（保存包含隐藏数据的图片）
4. 解码提取（从图片中恢复原始文件）

## 工作原理

IMGika 使用图片的 Alpha 通道来存储二进制数据：

1. **编码过程**:
   - 用户上传一张图片和一个需要隐藏的文件
   - 工具计算文件的 SHA256 校验和
   - 创建包含文件信息的头部数据（文件大小、原始宽度、SHA256）
   - 将头部数据和文件内容依次写入图片像素的 Alpha 通道
   - 生成并下载包含隐藏数据的新图片

2. **解码过程**:
   - 用户上传经过编码处理的图片
   - 工具读取图片 Alpha 通道中的数据
   - 解析头部信息获取文件大小和校验和
   - 提取文件数据并验证完整性
   - 提供原始文件下载

## 安装和运行

### 1. 克隆项目

```bash
git clone <repository-url>
cd IMGikaWeb
```

### 2. 安装依赖

推荐使用 `pnpm`:

```bash
pnpm install
```

或者使用 `npm`:

```bash
npm install
```

### 3. 启动开发服务器

```bash
pnpm dev
```

这将在本地启动一个开发服务器，通常在 `http://localhost:5173`

### 4. 构建生产版本

```bash
pnpm build
```

这会将应用程序构建到 `dist` 目录中，用于生产部署

### 5. 预览生产版本

```bash
pnpm preview
```

这会在本地启动一个服务器，用于预览构建好的生产版本

## 部署

此项目可以轻松部署到任何支持静态文件托管的服务，如：
- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

构建完成后，只需将 `dist` 目录中的文件部署到您的托管服务即可。

## 许可证

本项目采用 MIT 许可证进行许可。详情请见 [LICENSE](./LICENSE) 文件。