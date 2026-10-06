import React from 'react';

/**
 * Converts rich HTML clipboard data (from Google Docs, Word, web pages) into clean Markdown pretext.
 */
export function htmlToMarkdownPretext(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    function processNode(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const childrenText = Array.from(el.childNodes).map(processNode).join('');

      switch (tag) {
        case 'h1':
          return `\n# ${childrenText.trim()}\n\n`;
        case 'h2':
          return `\n## ${childrenText.trim()}\n\n`;
        case 'h3':
          return `\n### ${childrenText.trim()}\n\n`;
        case 'h4':
        case 'h5':
        case 'h6':
          return `\n#### ${childrenText.trim()}\n\n`;
        case 'strong':
        case 'b':
          return childrenText.trim() ? `**${childrenText.trim()}**` : '';
        case 'em':
        case 'i':
          return childrenText.trim() ? `*${childrenText.trim()}*` : '';
        case 'del':
        case 's':
        case 'strike':
          return childrenText.trim() ? `~~${childrenText.trim()}~~` : '';
        case 'code':
          return el.parentElement?.tagName.toLowerCase() === 'pre'
            ? childrenText
            : `\`${childrenText}\``;
        case 'pre':
          return `\n\`\`\`\n${childrenText.trim()}\n\`\`\`\n\n`;
        case 'blockquote':
          return `\n> ${childrenText.trim()}\n\n`;
        case 'li': {
          const isOrdered = el.parentElement?.tagName.toLowerCase() === 'ol';
          const index = Array.from(el.parentElement?.children || []).indexOf(el) + 1;
          const prefix = isOrdered ? `${index}. ` : '• ';
          return `\n${prefix}${childrenText.trim()}`;
        }
        case 'ul':
        case 'ol':
          return `\n${childrenText}\n\n`;
        case 'p':
        case 'div':
          return `\n${childrenText.trim()}\n`;
        case 'br':
          return '\n';
        case 'a': {
          const href = el.getAttribute('href');
          return href && href !== childrenText.trim() ? `[${childrenText.trim()}](${href})` : childrenText;
        }
        case 'hr':
          return '\n---\n\n';
        default:
          return childrenText;
      }
    }

    const result = processNode(body)
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return result;
  } catch {
    return '';
  }
}

/**
 * Handles rich text pasting into standard textarea elements:
 * converts HTML markup to formatted markdown pretext automatically.
 */
export function handlePretextPaste(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  onChange: (newVal: string) => void,
  currentVal: string,
  maxLength = 5000
) {
  const html = e.clipboardData?.getData('text/html');
  const plain = e.clipboardData?.getData('text/plain') || '';

  let textToInsert = plain;
  if (html && html.includes('<') && (html.includes('<b>') || html.includes('<strong>') || html.includes('<li>') || html.includes('<h') || html.includes('<i>'))) {
    const converted = htmlToMarkdownPretext(html);
    if (converted && converted.length > 0) {
      textToInsert = converted;
    }
  }

  if (!textToInsert) return;

  const target = e.currentTarget;
  const start = target.selectionStart || 0;
  const end = target.selectionEnd || 0;

  e.preventDefault();
  const nextVal = (currentVal.slice(0, start) + textToInsert + currentVal.slice(end)).slice(0, maxLength);
  onChange(nextVal);

  // Restore cursor position
  requestAnimationFrame(() => {
    target.selectionStart = target.selectionEnd = start + textToInsert.length;
  });
}

/**
 * Renders inline markdown tokens (bold, italics, code, strikethrough, links, emojis).
 */
export function renderInlineFormattedTokens(text: string, keyPrefix = 'tok'): React.ReactNode[] {
  if (!text) return [];

  // Match bold/italic, code, strikethrough, links, URLs
  // Patterns:
  // 1. Links: [text](url)
  // 2. Raw URLs: https?://...
  // 3. Bold-Italic: ***text*** or ___text___
  // 4. Bold: **text** or __text__
  // 5. Italic: *text* or _text_
  // 6. Strikethrough: ~~text~~
  // 7. Inline code: `text`
  const regex = /(\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<)]+|\*[^*]+\*|_[^_]+_)/g;

  const parts = text.split(regex);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;

    if (!part) return null;

    // Link [label](url)
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const [, label, url] = match;
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-500 dark:text-[#8ab4f8] hover:underline font-medium inline-flex items-center gap-0.5"
          >
            {label}
          </a>
        );
      }
    }

    // Raw URL
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={key}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-500 dark:text-[#8ab4f8] hover:underline break-all inline"
        >
          {part}
        </a>
      );
    }

    // Bold Italic ***text*** or ___text___
    if ((part.startsWith('***') && part.endsWith('***')) || (part.startsWith('___') && part.endsWith('___'))) {
      const inner = part.slice(3, -3);
      return (
        <strong key={key} className="font-bold italic text-theme-text">
          {inner}
        </strong>
      );
    }

    // Bold **text** or __text__
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      const inner = part.slice(2, -2);
      return (
        <strong key={key} className="font-semibold text-theme-text">
          {inner}
        </strong>
      );
    }

    // Strikethrough ~~text~~
    if (part.startsWith('~~') && part.endsWith('~~')) {
      const inner = part.slice(2, -2);
      return (
        <del key={key} className="line-through text-theme-text-muted">
          {inner}
        </del>
      );
    }

    // Inline Code `text`
    if (part.startsWith('`') && part.endsWith('`')) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-theme-hover font-mono text-[0.88em] text-theme-text border border-theme-border/40 inline-block align-baseline"
        >
          {inner}
        </code>
      );
    }

    // Italic *text* or _text_
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      const inner = part.slice(1, -1);
      return (
        <em key={key} className="italic text-theme-text">
          {inner}
        </em>
      );
    }

    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}
