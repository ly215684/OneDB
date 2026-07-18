import React, { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

// ─── Types ──────────────────────────────────────────────────

type DialogType = 'alert' | 'confirm' | 'prompt' | 'select';
type DialogVariant = 'info' | 'success' | 'warning' | 'error';

interface SelectOption {
  label: string;
  value: string;
}

interface DialogConfig {
  open: boolean;
  type: DialogType;
  variant: DialogVariant;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  options?: SelectOption[];
  confirmText: string;
  cancelText: string;
}

interface DialogContextValue {
  alert: (message: string, options?: { title?: string; variant?: DialogVariant }) => Promise<void>;
  confirm: (message: string, options?: { title?: string; variant?: DialogVariant; confirmText?: string }) => Promise<boolean>;
  prompt: (message: string, options?: { title?: string; placeholder?: string; defaultValue?: string }) => Promise<string | null>;
  select: (message: string, options: { title?: string; options: SelectOption[]; defaultValue?: string }) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}

// ─── Variant icons ──────────────────────────────────────────

const variantConfig: Record<DialogVariant, { icon: React.ReactNode; color: string; bg: string }> = {
  info: {
    icon: <Info size={20} />,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  success: {
    icon: <CheckCircle2 size={20} />,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  warning: {
    icon: <AlertTriangle size={20} />,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  error: {
    icon: <AlertCircle size={20} />,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
};

// ─── Provider ───────────────────────────────────────────────

const closedConfig: DialogConfig = {
  open: false,
  type: 'alert',
  variant: 'info',
  title: '',
  confirmText: '',
  cancelText: '',
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<DialogConfig>(closedConfig);
  const [inputValue, setInputValue] = useState('');
  const [visible, setVisible] = useState(false); // controls mount
  const [animating, setAnimating] = useState(false); // controls animation
  const resolveRef = useRef<((value: any) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  // Open dialog with animation
  const openDialog = useCallback((cfg: Omit<DialogConfig, 'open'>, resolve: (value: any) => void) => {
    resolveRef.current = resolve;
    setConfig({ ...cfg, open: true });
    setVisible(true);
    // Trigger enter animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimating(true);
      });
    });
  }, []);

  // Close dialog with animation, then resolve
  const closeDialog = useCallback((value: any) => {
    setAnimating(false);
    setTimeout(() => {
      resolveRef.current?.(value);
      resolveRef.current = null;
      setConfig(closedConfig);
      setVisible(false);
    }, 160);
  }, []);

  const alert = useCallback((message: string, options?: { title?: string; variant?: DialogVariant }) => {
    return new Promise<void>((resolve) => {
      openDialog(
        {
          type: 'alert',
          variant: options?.variant || 'info',
          title: options?.title || '',
          message,
          confirmText: t('dialog.ok'),
          cancelText: '',
        },
        () => resolve()
      );
    });
  }, [openDialog]);

  const confirm = useCallback((message: string, options?: { title?: string; variant?: DialogVariant; confirmText?: string }) => {
    return new Promise<boolean>((resolve) => {
      openDialog(
        {
          type: 'confirm',
          variant: options?.variant || 'warning',
          title: options?.title || '',
          message,
          confirmText: options?.confirmText || t('dialog.confirm'),
          cancelText: t('dialog.cancel'),
        },
        (v) => resolve(v as boolean)
      );
    });
  }, [openDialog]);

  const prompt = useCallback((message: string, options?: { title?: string; placeholder?: string; defaultValue?: string }) => {
    return new Promise<string | null>((resolve) => {
      openDialog(
        {
          type: 'prompt',
          variant: 'info',
          title: options?.title || '',
          message,
          placeholder: options?.placeholder,
          defaultValue: options?.defaultValue || '',
          confirmText: t('dialog.ok'),
          cancelText: t('dialog.cancel'),
        },
        (v) => resolve(v as string | null)
      );
    });
  }, [openDialog]);

  const select = useCallback((message: string, options: { title?: string; options: SelectOption[]; defaultValue?: string }) => {
    return new Promise<string | null>((resolve) => {
      openDialog(
        {
          type: 'select',
          variant: 'info',
          title: options.title || '',
          message,
          options: options.options,
          defaultValue: options.defaultValue || options.options[0]?.value || '',
          confirmText: t('dialog.ok'),
          cancelText: t('dialog.cancel'),
        },
        (v) => resolve(v as string | null)
      );
    });
  }, [openDialog]);

  // Focus input when prompt/select opens
  useEffect(() => {
    if (config.open && (config.type === 'prompt' || config.type === 'select') && animating) {
      setInputValue(config.defaultValue || '');
      if (config.type === 'prompt') {
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    }
  }, [config.open, config.type, config.defaultValue, animating]);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && config.open) {
        closeDialog(config.type === 'alert' ? undefined : config.type === 'confirm' ? false : null);
      }
    };
    if (config.open) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [config.open, config.type, closeDialog]);

  const handleConfirm = () => {
    if (config.type === 'alert') closeDialog(undefined);
    else if (config.type === 'confirm') closeDialog(true);
    else closeDialog(inputValue);
  };

  const handleCancel = () => {
    if (config.type === 'alert') closeDialog(undefined);
    else if (config.type === 'confirm') closeDialog(false);
    else closeDialog(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
  };

  const vc = variantConfig[config.variant];

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt, select }}>
      {children}

      {visible && (
        <div
          className={clsx(
            'fixed inset-0 z-[100] flex items-center justify-center',
            'bg-black/40 backdrop-blur-[2px]',
            'transition-opacity duration-150',
            animating ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div
            className={clsx(
              'bg-popover text-popover-foreground rounded-xl shadow-2xl shadow-black/20',
              'w-full max-w-sm mx-4 overflow-hidden',
              'transition-all duration-150 ease-out',
              animating
                ? 'scale-100 opacity-100 translate-y-0'
                : 'scale-95 opacity-0 translate-y-2'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-0">
              <div className="flex items-center gap-2.5">
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', vc.bg)}>
                  <span className={vc.color}>{vc.icon}</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {config.title || (config.type === 'alert' ? t('dialog.notice') : config.type === 'confirm' ? t('dialog.confirmTitle') : t('dialog.input'))}
                </h3>
              </div>
              <button
                onClick={handleCancel}
                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pt-3 pb-4">
              {config.message && (
                <p className="text-sm text-muted-foreground leading-relaxed ml-[42px]">{config.message}</p>
              )}

              {(config.type === 'prompt' || config.type === 'select') && (
                <div className="mt-3 ml-[42px]">
                  {config.type === 'prompt' ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={config.placeholder}
                      className={clsx(
                        'w-full h-9 px-3 text-sm rounded-lg',
                        'border border-border bg-background',
                        'text-foreground placeholder:text-muted-foreground/60',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                        'transition-all duration-200'
                      )}
                    />
                  ) : (
                    <select
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className={clsx(
                        'w-full h-9 px-3 text-sm rounded-lg',
                        'border border-border bg-background',
                        'text-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                        'transition-all duration-200 cursor-pointer'
                      )}
                    >
                      {config.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 mt-5">
                {config.type !== 'alert' && (
                  <button
                    onClick={handleCancel}
                    className={clsx(
                      'h-8 px-4 text-xs font-medium rounded-lg',
                      'border border-border text-muted-foreground',
                      'hover:bg-muted hover:text-foreground',
                      'transition-colors duration-150'
                    )}
                  >
                    {config.cancelText}
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  className={clsx(
                    'h-8 px-4 text-xs font-medium rounded-lg',
                    'bg-primary text-primary-foreground',
                    'hover:bg-primary/90 active:bg-primary/80',
                    'shadow-sm hover:shadow',
                    'transition-all duration-150'
                  )}
                >
                  {config.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
