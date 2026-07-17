import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'destructive' | 'outline' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children: React.ReactNode;
}

export function Button({ variant = 'default', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
          'hover:bg-hover hover:text-foreground': variant === 'ghost',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
          'border border-border bg-transparent hover:bg-hover': variant === 'outline',
          'text-primary underline-offset-4 hover:underline': variant === 'link',
        },
        {
          'h-7 px-3 text-xs gap-1.5': size === 'sm',
          'h-8 px-4 text-sm gap-2': size === 'md',
          'h-9 px-6 text-sm gap-2': size === 'lg',
          'h-7 w-7': size === 'icon',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
