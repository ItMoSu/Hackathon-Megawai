import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-bold text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            className={`flex h-12 w-full appearance-none rounded-lg border bg-white px-4 py-2 pr-8 text-sm text-black shadow-sm transition-colors 
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
            ${
              error 
                ? 'border-danger focus-visible:ring-danger' 
                : 'border-border focus-visible:ring-primary' 
            }
            ${className}`}
            ref={ref}
            {...props}
          >
            <option value="" disabled>Pilih satuan...</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && <p className="mt-1 text-sm text-danger font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";