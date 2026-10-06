import React, { useEffect } from 'react';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  icon?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonId?: string;
  cancelButtonId?: string;
  options?: {
    id: string;
    label: string;
    description?: string;
    selected?: boolean;
    onSelect?: () => void;
  }[];
}

export default function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
  confirmButtonId = 'dialog-confirm-button',
  cancelButtonId = 'dialog-cancel-button',
  options,
}: ConfirmationDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      id="confirmation-dialog-backdrop"
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        id="confirmation-dialog-container"
        className="bg-theme-card text-theme-text border-0 w-full max-w-[380px] sm:max-w-md rounded-[28px] shadow-2xl overflow-hidden p-6 sm:p-7 animate-in zoom-in-95 duration-200 relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title & Description Header */}
        <div className="flex flex-col">
          <h3 id="dialog-title" className="text-[20px] font-semibold text-theme-text leading-tight tracking-tight">
            {title}
          </h3>
          {description && (
            <div className="text-[14px] text-theme-text-muted mt-2.5 leading-relaxed font-normal">
              {description}
            </div>
          )}
        </div>

        {/* Optional Choices / Items List if provided */}
        {options && options.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5 py-1">
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={opt.onSelect}
                className={`w-full text-left p-3.5 rounded-2xl transition-colors flex items-center justify-between ${
                  opt.selected
                    ? 'bg-blue-600/10 dark:bg-blue-500/15'
                    : 'hover:bg-theme-hover'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className={`text-[15px] font-medium leading-snug ${opt.selected ? 'text-blue-600 dark:text-[#8ab4f8]' : 'text-theme-text'}`}>
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="text-[12px] text-theme-text-muted mt-0.5 leading-normal">
                      {opt.description}
                    </span>
                  )}
                </div>
                {opt.selected && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Native Action Buttons */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-1">
          {cancelLabel && (
            <button
              id={cancelButtonId}
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-full text-[14px] font-medium text-theme-text hover:bg-theme-hover active:bg-theme-border/40 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            id={confirmButtonId}
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-full text-[14px] font-semibold transition-all ${
              isDestructive
                ? 'text-red-500 dark:text-red-400 hover:bg-red-500/10 active:bg-red-500/20'
                : 'text-blue-600 dark:text-[#8ab4f8] hover:bg-blue-500/10 active:bg-blue-500/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
