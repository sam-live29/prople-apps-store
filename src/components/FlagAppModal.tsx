import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface FlagAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmFlag: (reason: string) => void;
  isAlreadyFlagged?: boolean;
}

const APP_FLAG_REASONS = [
  { id: 'sexual', label: 'Sexual content' },
  { id: 'graphic_violence', label: 'Graphic violence' },
  { id: 'hate_harassment', label: 'Hateful or abusive content' },
  { id: 'harmful_device', label: 'Harmful to device or data' },
  { id: 'improper_rating', label: 'Improper content rating' },
  { id: 'other', label: 'Other objection' }
];

export function FlagAppModal({
  isOpen,
  onClose,
  onConfirmFlag,
  isAlreadyFlagged
}: FlagAppModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(APP_FLAG_REASONS[0].label);

  if (!isOpen) return null;

  return (
    <div
      id="flag-app-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="flag-app-modal-content"
        className="w-full max-w-sm bg-theme-bg p-5 shadow-2xl space-y-3 rounded-none border-0 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Left top corner cross icon + title */}
        <div className="flex items-center gap-3 pb-1">
          <button
            type="button"
            onClick={onClose}
            className="p-1 -ml-1 text-theme-text-muted hover:text-theme-text active:bg-theme-hover transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-base sm:text-lg font-medium text-theme-text">
            Flag as inappropriate
          </h3>
        </div>

        {isAlreadyFlagged ? (
          <div className="py-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-theme-hover text-theme-text mx-auto flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-theme-text">You have already flagged this app</p>
            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-theme-hover text-theme-text text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Reports type list only - Android native radio style */}
            <div className="space-y-0.5 py-1">
              {APP_FLAG_REASONS.map((r) => {
                const isSelected = selectedReason === r.label;
                return (
                  <label
                    key={r.id}
                    onClick={() => setSelectedReason(r.label)}
                    className="flex items-center gap-3.5 py-2.5 px-1 cursor-pointer select-none text-theme-text hover:bg-theme-hover/40 transition-colors"
                  >
                    <div className="relative flex items-center justify-center shrink-0">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'border-blue-500'
                            : 'border-theme-text-muted/60'
                        }`}
                      >
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-normal text-theme-text leading-snug">
                      {r.label}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Android Native Actions */}
            <div className="flex items-center justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirmFlag(selectedReason);
                  onClose();
                }}
                className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm cursor-pointer"
              >
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
