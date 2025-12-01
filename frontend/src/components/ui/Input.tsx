import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
label?: string;
error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, ...props }, ref) => {
        return (
        <div className="w-full">
            {label && (
            <label className="mb-2 block text-sm font-bold text-secondary">
                {label}
            </label>
            )}

            <input
            type={type}
            className={`flex h-12 w-full rounded-lg border bg-white px-4 py-2 text-sm text-black shadow-sm transition-colors 
                file:border-0 file:bg-transparent file:text-sm file:font-medium 
                placeholder:text-gray-400 
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 
                ${
                error 
                    ? 'border-danger focus-visible:ring-danger' 
                    : 'border-border focus-visible:ring-primary' 
                }
                ${className}`}
            ref={ref}
            {...props}
            />
            {error && (
            <p className="mt-1 text-sm text-danger font-medium">{error}</p>
            )}
        </div>
        );
    }
);
Input.displayName = "Input";