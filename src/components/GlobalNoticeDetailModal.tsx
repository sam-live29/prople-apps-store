import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { NotificationItem } from '../types';

export interface GlobalNoticeDetailModalProps {
  isOpen: boolean;
  notice: NotificationItem | null;
  onClose: () => void;
  onDelete?: (notice: NotificationItem) => void;
  onOpenAppDetail?: (appId: string) => void;
}

export default function GlobalNoticeDetailModal({
  isOpen,
  notice,
  onClose
}: GlobalNoticeDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !notice) return null;

  return (
    <div
      id="global-notice-modal-backdrop"
      className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-3 sm:p-4 select-text animate-in fade-in duration-100"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-notice-modal-title"
    >
      {/* Straight Corner Pop Up Window - Flat, No Icons, No Card Boundaries, No Border */}
      <div
        id="global-notice-modal-container"
        className="relative w-full max-w-lg bg-theme-card text-theme-text border-0 rounded-none shadow-2xl overflow-hidden outline-none animate-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Straight Corner Cross Button */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <span
            id="global-notice-modal-title"
            className="text-xs uppercase tracking-wider font-semibold text-theme-text-muted"
          >
            Notice Details
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-none text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            aria-label="Close"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* Flat Sections Exactly as Input - No Icons, No Backgrounds, No Boundaries */}
        <div className="px-6 pb-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Notice Headline / Title */}
          <div>
            <div className="text-xs font-medium text-theme-text-muted mb-1">
              Notice Headline / Title
            </div>
            <div className="text-sm font-semibold text-theme-text break-words">
              {notice.title || '—'}
            </div>
          </div>

          {/* Notice Category */}
          <div>
            <div className="text-xs font-medium text-theme-text-muted mb-1">
              Notice Category
            </div>
            <div className="text-sm text-theme-text capitalize">
              {notice.category ? notice.category.replace('_', ' ') : 'announcement'}
            </div>
          </div>

          {/* Notification Message Body */}
          <div>
            <div className="text-xs font-medium text-theme-text-muted mb-1">
              Notification Message Body
            </div>
            <div className="text-sm text-theme-text whitespace-pre-wrap leading-relaxed">
              {notice.message || '—'}
            </div>
          </div>

          {/* Optional Action URL (Deep Link) */}
          <div>
            <div className="text-xs font-medium text-theme-text-muted mb-1">
              Optional Action URL (Deep Link)
            </div>
            <div className="text-sm text-theme-text break-all font-mono">
              {notice.actionUrl || '—'}
            </div>
          </div>

          {/* Action Button Label */}
          <div>
            <div className="text-xs font-medium text-theme-text-muted mb-1">
              Action Button Label
            </div>
            <div className="text-sm text-theme-text">
              {notice.actionLabel || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
