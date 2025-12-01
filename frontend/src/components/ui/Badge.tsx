import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    children: React.ReactNode;
    variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning';
}

export const Badge: React.FC<BadgeProps> = ({ 
    children, 
    className = '', 
    variant = 'default',
    ...props 
}) => {

    const variants = {
        default: "bg-primary text-white border-transparent",
        secondary: "bg-secondary text-white border-transparent",
        outline: "text-primary border-primary bg-transparent",
        success: "bg-green-100 text-green-800 border-green-200",
        warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    };
    
    return (
        <span 
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </span>
    );
};