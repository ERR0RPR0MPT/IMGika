import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-[var(--md-sys-color-outline-variant)]/30 pt-12 pb-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[var(--md-sys-color-on-surface-variant)]">
        
        <div className="flex items-center gap-4">
             <div className="flex flex-col">
                 <span className="font-bold text-[var(--md-sys-color-on-surface)]">IMGika</span>
                 <span className="text-xs font-mono opacity-80">图片隐写工具</span>
             </div>
        </div>

        <div className="flex flex-col items-center md:items-end text-sm">
             <p>© {new Date().getFullYear()} IMGika - 基于 Web 的图片隐写工具</p>
             <p className="text-xs font-mono opacity-60 mt-1">所有处理都在浏览器中完成，保障您的数据安全</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
