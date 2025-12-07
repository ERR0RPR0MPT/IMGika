# Material You CESHRC

基于 React 和 TypeScript 构建的个人网站。此示例为单页应用，专注于视觉设计，包括深色/浅色模式切换和动态背景效果。当然，你也可以套用Design来修改成您想要的任意网站类型。

> No.A0001
> Powered by CESHRC

## Demo

[Chongxi's Homepage](https://chongxi.us)

## feature

*   **profile**: `Hero` 部分和 `ProfileCard` 展示个人简介和核心信息
*   **repo**: `ProjectGrid` 以网格布局展示个人项目
*   **view**: `ActivitySection` 显示最近动态
*   **link**: `ConnectGrid` 和 `PersonalLinks` 提供社交链接
*   **interaction**:  `ScrollReveal` 实现滚动时内容动画
*   **switch**: 支持深色/浅色模式
*   **background**: Pixel开机向导高仿背景

## tech

*   **前端**: React (v19.2.0)
*   **使用**: TypeScript (v5.9.3)
*   **构建**: Vite (v7.2.4)
*   **样式**: Tailwind CSS
*   **动画**: CSS 和 `ScrollReveal`

## structure

```
.
├───App.tsx                 # 应用主入口，~~搞半天原来能自动拼~~
├───config.ts               # 主配置
├───index.css               # 全局
├───index.html              # HTML 模板
├───index.tsx               # React 渲染入口
├───package.json            # 依赖和脚本
├───pnpm-lock.yaml          # pnpm lock
├───tailwind.config.js      # Tailwind CSS 配置
├───tsconfig.json           # TypeScript 配置
├───vite.config.ts          # Vite 配置
└───components/             # UI 组件目录
    ├───ActivitySection.tsx # 动态
    ├───ConnectGrid.tsx     # 联系方式
    ├───Dashboard.tsx       # 仪表盘
    ├───ExpandingButton.tsx # 可扩展按钮
    ├───FloatingActionButton.tsx # 浮动操作按钮
    ├───Footer.tsx          # 页脚
    ├───Hero.tsx            # 介绍
    ├───Navbar.tsx          # 导航栏
    ├───PersonalLinks.tsx   # 个人链接
    ├───ProfileCard.tsx     # 个人资料
    ├───ProfileDossier.tsx  # 详细个人资料(目前未启用)
    ├───ProjectGrid.tsx     # 项目网格
    ├───ScrollReveal.tsx    # 滚动动画
    └───useClickOutside.tsx # 点击外部 Hook
```

## Setup

### 1. Fork 此仓库并 clone 到您的设备

### 2. 安装依赖

推荐使用 `pnpm`
~~npm最大的用处是安装pnpm~~

```bash
pnpm install
```

或者使用 `npm`

```bash
npm install
```

### 3. server

```bash
pnpm dev
```

这将在本地启动一个开发服务器，`http://localhost:5173`

### 4. build

```bash
pnpm build
```

这会将应用程序构建到 `dist` 目录中，用于生产部署

### 5. preview

```bash
pnpm preview
```

这会在本地启动一个服务器，用于预览构建好的生产版本

## 部署到 Cloudflare Pages

此项目可以轻松部署到 Cloudflare Pages。请按照以下步骤操作：

1.  保证此项目已正确放置在 GitHub repo
2.  登录到您的 Cloudflare 帐户，导航到 Pages
3.  选择“创建项目”并连接您的 Git 仓库
4.  在配置构建设置时，使用以下配置：
    *   **构建命令**: `npm run build` (如果您使用 pnpm，也可以是 `pnpm build`)
    *   **构建输出目录**: `dist`
5.  点击“部署站点”。Cloudflare Pages 将会自动构建并部署

## 爆改指南

本项目高度模块化，旨在帮助开发者快速上手定制
### 1. 项目结构和核心组件

*   **`components/` 目录**: 这是存放所有 UI 组件的地方。每个文件都代表一个独立的、可复用的模块
*   **`App.tsx`**: 这是应用程序的根组件，负责组合 `components/` 目录中的各个模块来构建完整的页面布局
*   **`index.tsx`**: React 应用程序的入口文件，负责将 `App` 组件渲染到 HTML 页面中
*   **`config.ts`**: 全局配置或常量会放置在此处

### 2. 内容修改与替换

大多数文本和图片内容都直接在相应的组件文件中定义

*   **组件文本**: 直接编辑组件文件中的 JSX 代码，修改其中的标题、段落、按钮文本等
*   **图片/媒体**: 替换组件中引用的图片路径或 URL

### 3. 定制

本项目使用了 Tailwind CSS 和自定义 CSS 变量来实现样式和主题

*   **Tailwind CSS**:
    *   直接在 JSX 元素的 `className` 属性中使用 Tailwind CSS 提供的实用程序类来快速修改样式。例如，更改 `text-xl` 为 `text-2xl` 可以改变字体大小
    *   如果需要自定义 Tailwind 配置，可以修改 `tailwind.config.js` 文件
*   **主题变量**:
    *   `index.html` 中定义了基于 Material Design 3 的 CSS 变量（如 `--md-sys-color-primary`）。通过修改这些变量的值，可以全局改变网站的颜色主题
    *   `[data-theme="dark"]` 选择器下的变量用于深色模式
*   **自定义 CSS**:
    *   `index.css` 文件可以用于添加全局的自定义 CSS 规则或覆盖 Tailwind 的默认样式
    *   组件内部的自定义样式可以直接写在组件文件中，或者通过导入单独的 CSS 模块

### 4. 结构

*   **改造 `App.tsx`**:
    *   您可以根据需求彻底重构 `App.tsx`，添加、删除或重新排列组件，以构建全新的页面布局。例如，可以引入 `react-router-dom` 来实现多页面应用，定义复杂的路由结构，将单页应用转变为多功能门户
*   **新建组件模块**:
    *   在 `components/` 目录下创建全新的 `.tsx` 文件来构建您自己的定制 UI 模块。这些新组件可以集成到任何现有布局中，或构成全新的界面元素
    

## 许可证

本项目采用 **知识共享署名 4.0 国际公共许可协议 (CC BY 4.0)** 进行许可。这意味着您可以自由地共享（复制和传播）以及演绎（修改和基于本项目进行创作），甚至出于商业目的

**署名要求：**
在使用或分发本项目（或其修改版本）时，您必须给出适当的署名，例如：

*   指出本网站模板/主题来源于 CESHRC(https://github.com/ChongxiSama/CESHRC-A001)
*   提供指向许可协议的链接：`https://creativecommons.org/licenses/by/4.0/`
*   指明是否作了修改。

您必须以任何合理的方式这样做，但不得以任何方式暗示许可人（即您本人）认可您或您的使用