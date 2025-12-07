// config.ts

type T = {
  [key: string]: any;
};

export const homepageTitle = "IMGika - 图片隐写工具";

// Profile
export const profile: T = {
  name: "IMGika",
  role: "图片隐写工具",
  slogan: [
    { text: "将文件隐藏在 " },
    { text: "图片中", highlighted: true },
    { text: "。一款 " },
    { text: "前端隐写工具", highlighted: true },
    { text: "。" }
  ],
};

// Section
export const sections: T = {
  encode: "编码",
  decode: "解码",
  howItWorks: "工作原理",
};

// Project
export const projects: T[] = [
  {
    title: "IMGika",
    description: "基于 Web 的图片隐写工具，可在浏览器中将文件隐藏在图片中。",
    status: "active",
    tech: ["React", "TypeScript", "Vite", "Tailwind CSS"],
    link: "https://github.com/your-repo/imgika",
    featured: true,
  },
];

// Dashboard
export const dashboard: T = {
  skills: [
    "JavaScript", "TypeScript", "React", "Vite", "Tailwind CSS", "Canvas API", "File API"
  ],
};

// Footer
export const footer: T = {
  line1: `© ${new Date().getFullYear()} IMGika - 所有权利保留。`,
  line2: "基于 Web 的图片隐写工具 // END OF LINE",
};