import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
size?: 'sm' | 'md' | 'lg';
isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
children,
className = '',
variant = 'primary',
size = 'md',
isLoading = false,
...props
}) => {

const baseStyles = "inline-flex items-center justify-center rounded-lg font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover focus:ring-primary",
    secondary: "bg-secondary text-white hover:bg-gray-800 focus:ring-gray-500",
    danger: "bg-danger text-white hover:bg-red-700 focus:ring-red-500",
    outline: "border-2 border-primary text-primary bg-transparent hover:bg-red-50",
    ghost: "text-gray-600 bg-transparent hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-300",
};

const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-2.5 text-base", 
    lg: "px-8 py-4 text-lg",
};

return (
    <button
    className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    disabled={isLoading || props.disabled}
    {...props}
    >
    {/* 5. Loading Spinner Logic */}
    {isLoading ? (
        <span className="mr-2 animate-spin">
        {/* Icon loading bulat sederhana */}
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        </span>
    ) : null}
    
    {children}
    </button>
    );
};