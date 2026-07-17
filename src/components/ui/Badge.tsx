import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium transition-colors',
        {
          'bg-secondary text-secondary-foreground': variant === 'default',
          'bg-green-500/10 text-green-600 dark:text-green-400': variant === 'success',
          'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400': variant === 'warning',
          'bg-red-500/10 text-red-600 dark:text-red-400': variant === 'destructive',
          'bg-blue-500/10 text-blue-600 dark:text-blue-400': variant === 'info',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
