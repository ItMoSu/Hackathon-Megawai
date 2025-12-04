import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <div 
        className={`rounded-xl border border-border bg-white text-black shadow-sm ${className}`} 
        {...props}
        >
        {children}
        </div>
    );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <div className={`flex flex-col space-y-1.5 p-6 pb-2 ${className}`} {...props}>
        {children}
        </div>
    );
};

export const CardContent: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <div className={`p-6 pt-2 ${className}`} {...props}>
        {children}
        </div>
    );
};

export const CardTitle: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props}>
        {children}
        </h3>
    );
};
