import React from 'react';
import { sections } from '../config';

const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      title: "上传文件",
      description: "选择一张图片和一个需要隐藏的文件",
      icon: "upload"
    },
    {
      title: "编码处理",
      description: "工具将文件数据隐藏在图片的 Alpha 通道中",
      icon: "image"
    },
    {
      title: "下载结果",
      description: "保存包含隐藏数据的图片文件",
      icon: "download"
    },
    {
      title: "解码提取",
      description: "上传处理后的图片以提取原始文件",
      icon: "lock_open"
    }
  ];

  return (
    <section className="w-full">
      <div className="flex items-center gap-4 mb-12">
        <span className="h-px flex-1 bg-[var(--md-sys-color-outline-variant)]/50"></span>
        <h2 className="text-[24px] sm:text-[32px] font-[500] text-[var(--md-sys-color-on-surface)]">{sections.howItWorks}</h2>
        <span className="h-px w-12 bg-[var(--md-sys-color-outline-variant)]/50"></span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((step, index) => (
          <div 
            key={index}
            className="group relative flex flex-col items-center p-6 rounded-[24px] bg-[var(--md-sys-color-surface-container-low)] transition-all duration-medium ease-emphasized hover:scale-[1.02] active:scale-[0.98] overflow-hidden animate-fade-in-up hover:rounded-[20px]"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="state-layer rounded-[inherit]"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="mb-4 p-3 rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
                <span className="material-symbols-rounded text-[24px]">{step.icon}</span>
              </div>
              
              <h3 className="relative z-10 text-[20px] font-medium leading-snug text-[var(--md-sys-color-on-surface)] mb-2">
                {step.title}
              </h3>
              
              <p className="relative z-10 text-[var(--md-sys-color-on-surface-variant)]">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorksSection;