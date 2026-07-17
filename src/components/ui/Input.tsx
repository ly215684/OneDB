import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-xs text-muted-foreground font-medium">{label}</label>}
        <input
          ref={ref}
          className={clsx(
            'h-8 px-3 text-sm rounded-md border border-border bg-background',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors',
            error && 'border-destructive focus:ring-destructive',
            className
          )}
          {...props}
        />
        {error && <span className="text-2xs text-destructive">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
