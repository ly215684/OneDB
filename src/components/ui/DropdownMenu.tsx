import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  hidden?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  trigger: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export function DropdownMenu({ items, trigger, align = 'left', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className={clsx('relative inline-flex', className)}>
      <div onClick={() => setOpen(!open)} className="inline-flex">{trigger}</div>
      {open && (
        <div
          className={clsx(
            'absolute z-50 mt-1 min-w-40 py-1 bg-popover border border-border rounded-md shadow-lg animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.filter((item) => !item.hidden).map((item, i) =>
            item.separator ? (
              <div key={i} className="my-1 border-t border-border" />
            ) : (
              <button
                key={i}
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className={clsx(
                  'w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  item.danger
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-foreground hover:bg-hover'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Context Menu (positioned)
interface ContextMenuProps {
  x: number;
  y: number;
  items: DropdownMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 30 - 20);

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-40 py-1 bg-popover border border-border rounded-md shadow-lg animate-fade-in"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.filter((item) => !item.hidden).map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 border-t border-border" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className={clsx(
              'w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              item.danger
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-foreground hover:bg-hover'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
