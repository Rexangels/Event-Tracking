import React, { useState } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'bottom' }) => {
    const [isVisible, setIsVisible] = useState(false);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    return (
        <div
            className="relative flex items-center"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className={`absolute z-[100] px-3 py-2 ${positionClasses[position]} pointer-events-none`}>
                    <div className="bg-slate-900/95 backdrop-blur-md border border-blue-500/30 text-slate-100 text-[10px] font-mono leading-relaxed rounded shadow-[0_0_20px_rgba(0,0,0,0.5)] min-w-[200px] animate-in fade-in zoom-in duration-200">
                        {/* Minimal Decorative Corner */}
                        <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-blue-500"></div>
                        <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-blue-500"></div>
                        <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-blue-500"></div>
                        <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-blue-500"></div>

                        <div className="flex items-center gap-2 mb-1 opacity-50 border-b border-slate-800 pb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span className="tracking-[0.2em] font-bold">INFO_MODULE</span>
                        </div>
                        {content}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tooltip;
