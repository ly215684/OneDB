import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export function Modal({ open, onClose, title, children, width = 'max-w-2xl', className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
    >
      <div className={clsx('bg-popover text-popover-foreground rounded-lg shadow-lg w-full mx-4 max-h-[85vh] flex flex-col animate-slide-in', width, className)}>
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="h-6 w-6 rounded flex items-center justify-center hover:bg-hover transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-auto px-1">{children}</div>
      </div>
    </div>
  );
}
