import React, { createContext, useContext, useState, useRef, ReactNode, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, FileText, RotateCcw, X, Download } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'draft' | 'discard' | 'install';

export interface ToastOptions {
  type?: ToastType;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
  onDismiss?: () => void;
  actionPlacement?: 'trailing' | 'inline';
  actionVariant?: 'default' | 'primary';
  icon?: ReactNode;
}

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  actionPlacement?: 'trailing' | 'inline';
  actionVariant?: 'default' | 'primary';
  icon?: ReactNode;
}

interface ToastContextType {
  showToast: (message: string, options?: ToastOptions) => void;
  dismissToast: () => void;
  toast: ToastData | null;
  isToastActive: boolean;
  hasActiveToast: () => boolean;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

function detectToastType(message: string, explicitType?: ToastType): ToastType {
  if (explicitType) return explicitType;
  const lower = message.toLowerCase();

  // 0. Install encouragement
  if (
    lower.includes('install') && 
    (lower.includes('pwa') || lower.includes('prople store') || lower.includes('native') || lower.includes('browser'))
  ) {
    return 'install';
  }

  // 1. Error / Failure
  if (
    lower.includes('error') || 
    lower.includes('fail') || 
    lower.includes('denied') || 
    lower.includes('unable') ||
    lower.includes('inappropriate') ||
    lower.includes('could not')
  ) {
    return 'error';
  }

  // 2. Draft actions
  if (lower.includes('draft')) {
    return 'draft';
  }

  // 3. Discarded actions
  if (lower.includes('discard')) {
    return 'discard';
  }

  // 4. Warning / Limits / Validation prompts
  if (
    lower.includes('limit') || 
    lower.includes('exhaustion') || 
    lower.includes('cooldown') || 
    lower.includes('warning') ||
    lower.includes('please enter') ||
    lower.includes('please provide') ||
    lower.includes('please select') ||
    lower.includes('required')
  ) {
    return 'warning';
  }

  // 5. Success (Publish, Update, Save, Delete/Remove)
  if (
    lower.includes('success') ||
    lower.includes('published') ||
    lower.includes('updated') ||
    lower.includes('saved') ||
    lower.includes('restored') ||
    lower.includes('submitted') ||
    lower.includes('removed') ||
    lower.includes('deleted')
  ) {
    return 'success';
  }

  // 6. Info / Clipboard / System notifications
  return 'info';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterRef = useRef<number>(0);
  const toastRef = useRef<ToastData | null>(null);
  toastRef.current = toast;

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    toastRef.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((newMessage: string, options?: ToastOptions) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    counterRef.current += 1;
    const type = detectToastType(newMessage, options?.type);

    const newToast: ToastData = {
      id: counterRef.current,
      message: newMessage,
      type,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
      onDismiss: options?.onDismiss,
      actionPlacement: options?.actionPlacement,
      actionVariant: options?.actionVariant,
      icon: options?.icon,
    };
    toastRef.current = newToast;
    setToast(newToast);

    const duration = options?.duration || (type === 'install' ? 10000 : 3800);
    timerRef.current = setTimeout(() => {
      toastRef.current = null;
      setToast(null);
      timerRef.current = null;
    }, duration);
  }, []);

  const hasActiveToast = useCallback(() => {
    return toastRef.current !== null || (typeof document !== 'undefined' && Boolean(document.getElementById('ai-studio-toast')));
  }, []);

  const renderIcon = (type: ToastType, customIcon?: ReactNode) => {
    if (customIcon) return customIcon;
    switch (type) {
      case 'install':
        return (
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 ring-1 ring-blue-500/40">
            <Download className="w-3.5 h-3.5 text-[#8ab4f8]" />
          </div>
        );
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-[#81c995] shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-[#f28b82] shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#fdd663] shrink-0" />;
      case 'draft':
        return <FileText className="w-4 h-4 text-[#8ab4f8] shrink-0" />;
      case 'discard':
        return <RotateCcw className="w-4 h-4 text-[#9aa0a6] shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-[#8ab4f8] shrink-0" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, toast, isToastActive: Boolean(toast), hasActiveToast }}>
      {children}
      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -28 }}
              animate={{ 
                opacity: 1, 
                y: 0,
                transition: { 
                  duration: 0.24, 
                  ease: [0.05, 0.7, 0.1, 1.0] 
                }
              }}
              exit={{ 
                opacity: 0, 
                y: -20,
                transition: { 
                  duration: 0.16, 
                  ease: [0.3, 0.0, 0.8, 0.15] 
                }
              }}
              role="status"
              aria-live="polite"
              id="ai-studio-toast"
              className="fixed top-3.5 sm:top-5 left-1/2 -translate-x-1/2 z-[200] flex items-center justify-between gap-3 px-4 py-3 sm:py-3.5 rounded-xl bg-[#28292a]/95 backdrop-blur-md text-[#f1f3f4] shadow-2xl shadow-black/70 max-w-[94vw] sm:max-w-xl w-full pointer-events-auto select-none"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="shrink-0 flex items-center justify-center">
                  {renderIcon(toast.type, toast.icon)}
                </div>

                <div className="text-[13px] sm:text-[14px] leading-snug font-normal text-[#f1f3f4] min-w-0 break-words">
                  {toast.message}
                  {toast.actionLabel && toast.onAction && toast.actionPlacement === 'inline' && (
                    <>
                      {' '}
                      <button
                        type="button"
                        id="ai-studio-toast-inline-action-btn"
                        onClick={() => {
                          toast.onAction?.();
                          dismissToast();
                        }}
                        className="inline font-medium text-[#8ab4f8] hover:text-[#aecbfa] underline underline-offset-2 hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        {toast.actionLabel}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {toast.actionLabel && toast.onAction && toast.actionPlacement !== 'inline' && (
                  <button
                    type="button"
                    id="ai-studio-toast-action-btn"
                    onClick={() => {
                      toast.onAction?.();
                      dismissToast();
                    }}
                    className={
                      toast.type === 'install' || toast.actionVariant === 'primary'
                        ? "text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 px-3.5 py-1.5 rounded-lg shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 select-none hover:scale-[1.02] active:scale-[0.98]"
                        : "text-xs font-medium text-[#8ab4f8] hover:text-[#aecbfa] px-2 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                    }
                  >
                    {(toast.type === 'install' || toast.actionVariant === 'primary') && (
                      <Download className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                    )}
                    <span>{toast.actionLabel}</span>
                  </button>
                )}

                <button
                  type="button"
                  id="ai-studio-toast-dismiss-btn"
                  onClick={() => {
                    toast.onDismiss?.();
                    dismissToast();
                  }}
                  className="p-1.5 text-[#9aa0a6] hover:text-[#f1f3f4] hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}



