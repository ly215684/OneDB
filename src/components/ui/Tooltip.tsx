import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  return (
    <div className="relative inline-flex">
      {children}
      <div
        className={clsx(
          'absolute z-[60] px-2 py-1 text-2xs bg-foreground text-background rounded shadow-md',
          'opacity-0 scale-95 pointer-events-none whitespace-nowrap',
          'transition-all duration-150 ease-out',
          {
            'bottom-full left-1/2 -translate-x-1/2 mb-1.5': position === 'top',
            'top-full left-1/2 -translate-x-1/2 mt-1.5': position === 'bottom',
            'right-full top-1/2 -translate-y-1/2 mr-1.5': position === 'left',
            'left-full top-1/2 -translate-y-1/2 ml-1.5': position === 'right',
          }
        )}
        style={{ contentVisibility: 'hidden' }}
      >
        {content}
      </div>
      {/* Hover target - show tooltip on parent hover */}
    </div>
  );
}

// Use CSS hover on the wrapper itself
export function HoverTooltip({ content, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), 400);
  };
  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {show && (
        <div
          className={clsx(
            'absolute z-[60] px-2 py-1 text-2xs bg-foreground text-background rounded shadow-md',
            'animate-in fade-in zoom-in-95 duration-150 pointer-events-none whitespace-nowrap',
            {
              'bottom-full left-1/2 -translate-x-1/2 mb-1.5': position === 'top',
              'top-full left-1/2 -translate-x-1/2 mt-1.5': position === 'bottom',
              'right-full top-1/2 -translate-y-1/2 mr-1.5': position === 'left',
              'left-full top-1/2 -translate-y-1/2 ml-1.5': position === 'right',
            }
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
