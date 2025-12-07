import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="flex flex-col items-center sm:items-start pt-8 sm:pt-16 w-full relative">
      
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Content */}
        <div className="lg:col-span-8 flex flex-col gap-8 z-10 text-center sm:text-left items-center sm:items-start">
            
            {/* Title */}
            <h1 className="text-5xl sm:text-7xl font-[500] leading-tight tracking-tight text-[var(--md-sys-color-on-surface)] animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              IMGika
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl sm:text-2xl text-[var(--md-sys-color-on-surface-variant)] font-light animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              将文件隐藏在图片中的前端工具
            </p>
            
            {/* Description */}
            <p className="text-lg text-[var(--md-sys-color-on-surface-variant)] max-w-3xl animate-fade-in-up" style={{ animationDelay: '450ms' }}>
              IMGika 是一个基于 Web 的工具，可以将任何文件的二进制数据隐藏在图片的 Alpha 通道中，
              实现隐写术的功能。所有处理都在浏览器中完成，保证您的数据隐私和安全。
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl animate-fade-in-up" style={{ animationDelay: '600ms' }}>
              <div className="bg-[var(--md-sys-color-surface-container)] p-4 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/20 text-center">
                <span className="material-symbols-rounded text-3xl text-[var(--md-sys-color-primary)] mb-2">privacy_tip</span>
                <p className="text-[var(--md-sys-color-on-surface-variant)]">完全本地处理</p>
              </div>
              <div className="bg-[var(--md-sys-color-surface-container)] p-4 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/20 text-center">
                <span className="material-symbols-rounded text-3xl text-[var(--md-sys-color-primary)] mb-2">image</span>
                <p className="text-[var(--md-sys-color-on-surface-variant)]">无损图片质量</p>
              </div>
              <div className="bg-[var(--md-sys-color-surface-container)] p-4 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/20 text-center">
                <span className="material-symbols-rounded text-3xl text-[var(--md-sys-color-primary)] mb-2">security</span>
                <p className="text-[var(--md-sys-color-on-surface-variant)]">安全可靠</p>
              </div>
            </div>
        </div>

        {/* Right Content */}
        <div className="lg:col-span-4 flex justify-center lg:justify-end animate-fade-in-up" style={{ animationDelay: '750ms' }}>
          <div className="relative group">
            {/* Morphing Blob */}
            <div className="absolute inset-0 scale-125 bg-[var(--md-sys-color-secondary-container)] animate-morph-2 blur-3xl opacity-60 mix-blend-multiply dark:mix-blend-screen"></div>
            
            {/* Logo Container */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 overflow-hidden
              bg-[var(--md-sys-color-surface-container)] shadow-2xl shadow-[var(--md-sys-color-shadow)]/10
              transition-all duration-extra-long ease-emphasized-decelerate
              border-[4px] border-[var(--md-sys-color-surface)]
              rounded-[48px]
              flex items-center justify-center">
               <div className="absolute inset-0 bg-gradient-to-tr from-[var(--md-sys-color-primary)]/10 to-transparent z-10 mix-blend-overlay"></div>
               <div className="text-[var(--md-sys-color-primary)] z-20">
                 <span className="material-symbols-rounded text-8xl">image</span>
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;