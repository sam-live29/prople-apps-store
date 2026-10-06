/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';

export interface PermissionGroundInputProps {
  icon: React.ReactNode;
  categoryName: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  showNoAccessButton?: boolean;
  onRemoveCategory?: () => void;
  className?: string;
}

/**
 * PermissionGroundInput — Production-grade natural-flow input for Play Store permissions.
 *
 * All bullet points register directly on the clean transparent input ground.
 * Zero nested scroll containers or touch traps — flows naturally with page scrolling.
 * Supports comma (,) or Enter to register points, click to focus, backspace to delete, and paste.
 */
export const PermissionGroundInput: React.FC<PermissionGroundInputProps> = ({
  icon,
  categoryName,
  items,
  onChange,
  placeholder = 'Add point and press Enter or comma...',
  showNoAccessButton = true,
  onRemoveCategory,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitValue = (raw: string) => {
    if (!raw) return;
    const parts = raw
      .split(/[\r\n,]+/)
      .map(p => p.trim().replace(/^[•\-\*]\s*/, ''))
      .filter(Boolean);

    if (parts.length === 0) return;

    // If current items only contain 'No access required' and user enters something new, replace it
    let current = items;
    if (current.length === 1 && current[0].toLowerCase() === 'no access required') {
      current = [];
    }

    const next = [...current];
    for (const part of parts) {
      if (!next.includes(part)) {
        next.push(part);
      }
    }
    onChange(next);
    setInputValue('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(',')) {
      commitValue(val);
    } else {
      setInputValue(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && items.length > 0) {
      e.preventDefault();
      const next = items.slice(0, -1);
      onChange(next);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted && (pasted.includes(',') || pasted.includes('\n'))) {
      e.preventDefault();
      commitValue(pasted);
    }
  };

  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next);
  };

  const handleSetNoAccess = () => {
    onChange(['No access required']);
    setInputValue('');
  };

  return (
    <div className={`space-y-1.5 group w-full ${className}`}>
      {/* Category Header & Actions (Completely transparent - no background) */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 select-none pointer-events-none">
          {icon}
          <span className="text-[12px] sm:text-[13px] font-medium text-theme-text-muted group-focus-within:text-blue-500 dark:group-focus-within:text-[#8ab4f8] font-google-sans leading-none transition-colors">
            {categoryName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showNoAccessButton && (
            <button
              type="button"
              onClick={handleSetNoAccess}
              className="text-[11px] text-theme-text-muted hover:text-blue-500 dark:hover:text-[#8ab4f8] hover:underline cursor-pointer transition-colors leading-none"
            >
              Set &quot;No access required&quot;
            </button>
          )}
          {onRemoveCategory && (
            <button
              type="button"
              onClick={onRemoveCategory}
              className="p-0.5 text-theme-text-muted hover:text-red-500 rounded transition-colors cursor-pointer leading-none"
              title={`Remove ${categoryName} category`}
              aria-label={`Remove ${categoryName} category`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Input Section Ground - Natural flow, zero nested scroll trap */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="w-full min-h-[90px] sm:min-h-[100px] bg-transparent border border-theme-border group-focus-within:border-blue-500 rounded-xl p-3 sm:p-3.5 transition-colors cursor-text flex flex-col justify-start"
      >
        <div className="space-y-1.5 w-full">
          {/* Registered Bullet Points on Ground */}
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-2 py-0.5 group/item"
            >
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span className="text-theme-text-muted select-none text-[13px] leading-relaxed shrink-0">
                  •
                </span>
                <span className="text-[13px] sm:text-[14px] text-theme-text leading-relaxed break-words font-normal">
                  {item}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(idx);
                }}
                className="text-theme-text-muted hover:text-red-400 p-0.5 rounded transition-colors shrink-0 cursor-pointer opacity-70 hover:opacity-100"
                title="Remove point"
                aria-label={`Remove ${item}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Input Field on the Ground */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-theme-text-muted select-none text-[13px] leading-none shrink-0">
              •
            </span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onBlur={() => {
                if (inputValue.trim()) {
                  commitValue(inputValue);
                }
              }}
              placeholder={items.length === 0 ? placeholder : 'Add point (Enter or comma)...'}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] sm:text-[14px] text-theme-text placeholder:text-theme-text-muted/60 min-w-[140px] leading-relaxed"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionGroundInput;
