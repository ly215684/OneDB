import React from 'react';
import { clsx } from 'clsx';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ScrollArea({ children, className, ...props }: ScrollAreaProps) {
  return (
    <div className={clsx('overflow-auto', className)} {...props}>
      {children}
    </div>
  );
}
