import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

export interface TagGroundInputProps {
  label: string;
  sublabel?: string;
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  onClear?: () => void;
  placeholder?: string;
  inputPlaceholder?: string;
  maxItemLength?: number;
  className?: string;
}

/**
 * TagGroundInput — Minimalist, borderless-pill, single-ground tag input.
 *
 * UX:
 * 1. Single unified container: user types directly inside the ground.
 * 2. Typing a sentence/phrase and pressing Enter or comma (,) creates a neutral pill.
 * 3. Pasting comma-separated or newline-separated text splits into pills.
 * 4. Backspace on empty input removes the most recent pill.
 * 5. Minimal monochrome pills (no bright colors, no borders).
 * 6. Zero prepared preset badges (completely user-driven).
 */
export const TagGroundInput: React.FC<TagGroundInputProps> = ({
  label,
  sublabel,
  items,
  onAdd,
  onRemove,
  onClear,
  placeholder,
  inputPlaceholder = 'Type and press Enter or comma...',
  maxItemLength = 80,
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitValue = (val: string) => {
    // Support comma or newline separated values
    const parts = val.split(/[,\n]/).map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (part && !items.includes(part)) {
        onAdd(part.slice(0, maxItemLength));
      }
    }
    setInputValue('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // If user types a comma, commit immediately
    if (val.includes(',')) {
      commitValue(val);
    } else {
      setInputValue(val.slice(0, maxItemLength));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && items.length > 0) {
      e.preventDefault();
      onRemove(items.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text && (text.includes(',') || text.includes('\n'))) {
      e.preventDefault();
      commitValue(text);
    }
  };

  return (
    <div className={`space-y-1.5 w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between min-h-[20px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <label className="block text-xs font-medium text-theme-text">
            {label}
          </label>
          {items.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-theme-hover text-theme-text-muted font-medium">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sublabel && (
            <span className="text-[10px] text-theme-text-muted hidden sm:inline">
              {sublabel}
            </span>
          )}
          {items.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] text-theme-text-muted hover:text-red-500 font-medium cursor-pointer transition-colors"
              title="Clear all"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* The Unified Input Ground */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="w-full min-h-[46px] bg-theme-hover/30 dark:bg-[#18191b] border border-theme-border/60 dark:border-[#303134] rounded-xl p-2 flex flex-wrap gap-1.5 items-center transition-colors focus-within:border-theme-text-muted focus-within:ring-1 focus-within:ring-theme-text-muted/20 cursor-text"
      >
        {/* Pills (Colorless & Borderless, Clean Minimal) */}
        {items.map((item, idx) => (
          <span
            key={`${item}-${idx}`}
            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-theme-hover dark:bg-[#28292c] text-theme-text text-xs font-normal leading-none shrink-0"
          >
            <span className="truncate max-w-[220px] sm:max-w-[320px]">{item}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(idx);
              }}
              className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-theme-text-muted hover:text-theme-text hover:bg-theme-card transition-colors cursor-pointer shrink-0"
              title={`Remove ${item}`}
              aria-label={`Remove ${item}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {/* Seamless Inline Input */}
        <input
          ref={inputRef}
          type="text"
          maxLength={maxItemLength}
          placeholder={items.length === 0 ? (placeholder || inputPlaceholder) : 'Add more...'}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => {
            if (inputValue.trim()) {
              commitValue(inputValue);
            }
          }}
          className="flex-1 min-w-[140px] bg-transparent text-xs text-theme-text outline-none placeholder:text-theme-text-muted/60 py-0.5 px-1 border-none"
        />
      </div>
    </div>
  );
};
