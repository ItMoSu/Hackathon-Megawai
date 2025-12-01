import React, { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ 
    isOpen, 
    onClose, 
    title, 
    children,
    footer 
}) => {

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onClose} 
        >
            <div 
                className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white p-6 text-left align-middle shadow-2xl transition-all m-4 border border-gray-200"
                onClick={(e) => e.stopPropagation()} 
            >
                <div className="flex items-center justify-between mb-5">
                    {title && <h3 className="text-xl font-bold leading-6 text-black">{title}</h3>}
                    <button
                        onClick={onClose}
                        className="rounded-full p-1 hover:bg-gray-100 transition-colors focus:outline-none"
                    >
                        {/* Icon Silang (X) */}
                        <svg className="h-6 w-6 text-gray-500 hover:text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="mt-2">
                {children}
                </div>
                
                {footer && (
                <div className="mt-6 flex justify-end gap-3">
                    {footer}
                </div>
                )}
            </div>
        </div>
    );
};