import { clsx } from 'clsx';
import { LucideIcon } from 'lucide-react';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  size?: number;
  variant?: 'default' | 'ghost' | 'active';
  label?: string;
}

export function IconButton({ icon: Icon, size = 16, variant = 'ghost', label, className, ...props }: IconButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded transition-colors',
        'w-7 h-7 flex-shrink-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        {
          'hover:bg-hover text-muted-foreground hover:text-foreground': variant === 'ghost',
          'bg-primary/10 text-primary hover:bg-primary/20': variant === 'active',
          'bg-hover text-foreground': variant === 'default',
        },
        className
      )}
      title={label}
      {...props}
    >
      <Icon size={size} strokeWidth={1.75} />
    </button>
  );
}
