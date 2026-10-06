import React, { useMemo } from 'react';
import { renderInlineFormattedTokens } from '../utils/textFormatter';

export interface FormattedPretextProps {
  text?: string | null;
  className?: string;
  charLimit?: number;
  fallbackText?: string;
}

export default function FormattedPretext({
  text,
  className = '',
  charLimit,
  fallbackText = ''
}: FormattedPretextProps) {
  const content = useMemo(() => {
    let raw = (text || '').trim();
    if (!raw && fallbackText) {
      raw = fallbackText.trim();
    }
    if (!raw) return '';

    if (charLimit && raw.length > charLimit) {
      raw = raw.slice(0, charLimit).trim() + '...';
    }
    return raw;
  }, [text, fallbackText, charLimit]);

  if (!content) return null;

  // Split into lines to parse markdown blocks
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block toggle (```)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        renderedElements.push(
          <pre
            key={`code-block-${i}`}
            className="p-3 my-2.5 rounded-lg bg-neutral-900/80 border border-theme-border/40 font-mono text-xs text-neutral-200 overflow-x-auto leading-relaxed"
          >
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Blank line -> Paragraph spacing
    if (!trimmed) {
      renderedElements.push(<div key={`blank-${i}`} className="h-2.5" />);
      continue;
    }

    // Horizontal Rule (---, ***, ___)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      renderedElements.push(
        <hr key={`hr-${i}`} className="border-t border-theme-border/40 my-3" />
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      renderedElements.push(
        <h1 key={`h1-${i}`} className="text-lg sm:text-xl font-bold font-google-sans text-theme-text mt-3 mb-1.5 leading-snug">
          {renderInlineFormattedTokens(trimmed.slice(2).trim(), `h1-${i}`)}
        </h1>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h2 key={`h2-${i}`} className="text-base sm:text-lg font-bold font-google-sans text-theme-text mt-2.5 mb-1 leading-snug">
          {renderInlineFormattedTokens(trimmed.slice(3).trim(), `h2-${i}`)}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h3 key={`h3-${i}`} className="text-[15px] sm:text-base font-semibold font-google-sans text-theme-text mt-2 mb-1 leading-snug">
          {renderInlineFormattedTokens(trimmed.slice(4).trim(), `h3-${i}`)}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      renderedElements.push(
        <h4 key={`h4-${i}`} className="text-sm sm:text-[15px] font-semibold text-theme-text mt-1.5 mb-0.5 leading-snug">
          {renderInlineFormattedTokens(trimmed.slice(5).trim(), `h4-${i}`)}
        </h4>
      );
      continue;
    }

    // Blockquote (> )
    if (trimmed.startsWith('> ') || trimmed === '>') {
      const quoteText = trimmed.slice(2).trim();
      renderedElements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-[3px] border-blue-500/70 pl-3 py-1 my-1.5 text-theme-text-muted italic bg-theme-hover/20 rounded-r text-[14px] sm:text-[15px] leading-relaxed"
        >
          {renderInlineFormattedTokens(quoteText, `quote-${i}`)}
        </blockquote>
      );
      continue;
    }

    // Bullet List Items (-, *, +, •, ▪, ▫, –, —)
    const bulletMatch = trimmed.match(/^([-*+•▪▫–—])\s+(.*)$/);
    if (bulletMatch) {
      const [, , itemText] = bulletMatch;
      renderedElements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2.5 my-1 leading-relaxed text-[14px] sm:text-[15px]">
          <span className="text-theme-text-muted select-none mt-0.5">•</span>
          <div className="flex-1 min-w-0">
            {renderInlineFormattedTokens(itemText, `bullet-item-${i}`)}
          </div>
        </div>
      );
      continue;
    }

    // Numbered List Items (1. , 1) , a. )
    const numberedMatch = trimmed.match(/^(\d+[\.\)]|[a-zA-Z][\.\)])\s+(.*)$/);
    if (numberedMatch) {
      const [, numPrefix, itemText] = numberedMatch;
      renderedElements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-1 leading-relaxed text-[14px] sm:text-[15px]">
          <span className="text-theme-text-muted font-mono text-xs font-semibold select-none mt-0.5 shrink-0">
            {numPrefix}
          </span>
          <div className="flex-1 min-w-0">
            {renderInlineFormattedTokens(itemText, `num-item-${i}`)}
          </div>
        </div>
      );
      continue;
    }

    // Key: Value definition check (e.g., "Camera: Required for barcode scanning")
    const keyValueMatch = trimmed.match(/^([A-Za-z0-9\s()_/-]{2,40}):\s+(.+)$/);
    if (keyValueMatch && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const [, keyName, valDesc] = keyValueMatch;
      renderedElements.push(
        <p key={`kv-${i}`} className="my-1.5 leading-relaxed text-[14px] sm:text-[15px]">
          <strong className="font-semibold text-theme-text">{keyName}: </strong>
          <span className="font-normal">{renderInlineFormattedTokens(valDesc, `kv-val-${i}`)}</span>
        </p>
      );
      continue;
    }

    // Standard Paragraph Line
    renderedElements.push(
      <p key={`line-${i}`} className="my-1 leading-relaxed text-[14px] sm:text-[15px] font-normal">
        {renderInlineFormattedTokens(line, `para-${i}`)}
      </p>
    );
  }

  // Handle unclosed code block at end of text
  if (inCodeBlock && codeBlockLines.length > 0) {
    renderedElements.push(
      <pre
        key="code-block-final"
        className="p-3 my-2.5 rounded-lg bg-neutral-900/80 border border-theme-border/40 font-mono text-xs text-neutral-200 overflow-x-auto leading-relaxed"
      >
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  return (
    <div className={`space-y-0.5 text-theme-text leading-relaxed break-words ${className}`}>
      {renderedElements}
    </div>
  );
}
