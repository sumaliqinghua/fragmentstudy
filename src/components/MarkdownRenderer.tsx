import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  highlightText?: string;
  highlightRef?: React.RefObject<HTMLSpanElement>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseInline(text: string): string {
  let result = escapeHtml(text);

  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
  result = result.replace(/__(.+?)__/g, '<strong class="font-bold">$1</strong>');
  result = result.replace(/_(.+?)_/g, '<em class="italic">$1</em>');
  result = result.replace(/`(.+?)`/g, '<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
  result = result.replace(/~~(.+?)~~/g, '<del class="line-through text-gray-500">$1</del>');

  return result;
}

function parseMarkdown(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList = false;
  let listItems: string[] = [];
  let inOrderedList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      if (inOrderedList) {
        result.push(`<ol class="list-decimal list-inside space-y-1 my-3 pl-2">${listItems.map(item => `<li class="text-gray-700">${item}</li>`).join('')}</ol>`);
      } else {
        result.push(`<ul class="list-disc list-inside space-y-1 my-3 pl-2">${listItems.map(item => `<li class="text-gray-700">${item}</li>`).join('')}</ul>`);
      }
      listItems = [];
      inList = false;
      inOrderedList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push(`<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-3"><code class="text-sm font-mono">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`);
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    if (line.startsWith('# ')) {
      flushList();
      result.push(`<h1 class="text-2xl font-bold text-gray-900 mt-6 mb-3">${parseInline(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      result.push(`<h2 class="text-xl font-bold text-gray-900 mt-5 mb-2">${parseInline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      result.push(`<h3 class="text-lg font-bold text-gray-900 mt-4 mb-2">${parseInline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('#### ')) {
      flushList();
      result.push(`<h4 class="text-base font-bold text-gray-900 mt-3 mb-1">${parseInline(line.slice(5))}</h4>`);
      continue;
    }

    if (line.startsWith('> ')) {
      flushList();
      result.push(`<blockquote class="border-l-4 border-teal-500 pl-4 my-3 text-gray-600 italic">${parseInline(line.slice(2))}</blockquote>`);
      continue;
    }

    if (line.startsWith('---') || line.startsWith('***') || line.startsWith('___')) {
      flushList();
      result.push('<hr class="my-6 border-gray-200" />');
      continue;
    }

    const unorderedMatch = line.match(/^[\-\*]\s+(.+)$/);
    if (unorderedMatch) {
      if (inList && inOrderedList) {
        flushList();
      }
      inList = true;
      inOrderedList = false;
      listItems.push(parseInline(unorderedMatch[1]));
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (inList && !inOrderedList) {
        flushList();
      }
      inList = true;
      inOrderedList = true;
      listItems.push(parseInline(orderedMatch[1]));
      continue;
    }

    flushList();

    if (line.trim() === '') {
      result.push('<div class="h-4"></div>');
    } else {
      result.push(`<p class="text-gray-700 leading-relaxed my-2">${parseInline(line)}</p>`);
    }
  }

  flushList();

  if (inCodeBlock && codeBlockContent.length > 0) {
    result.push(`<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-3"><code class="text-sm font-mono">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`);
  }

  return result.join('');
}

export function MarkdownRenderer({ content, className = '', highlightText, highlightRef }: MarkdownRendererProps) {
  const html = useMemo(() => {
    let parsed = parseMarkdown(content);

    if (highlightText && highlightText.length > 0) {
      const searchText = highlightText.substring(0, Math.min(50, highlightText.length));
      const escapedSearch = escapeHtml(searchText);
      const index = parsed.indexOf(escapedSearch);

      if (index !== -1) {
        const before = parsed.substring(0, index);
        const match = escapeHtml(highlightText);
        const matchEndIndex = parsed.indexOf(match, index);

        if (matchEndIndex !== -1) {
          const actualMatch = parsed.substring(matchEndIndex, matchEndIndex + match.length);
          const after = parsed.substring(matchEndIndex + match.length);
          parsed = `${before}<span class="bg-teal-100 text-teal-900 px-1 rounded border-l-4 border-teal-500" data-highlight="true">${actualMatch}</span>${after}`;
        }
      }
    }

    return parsed;
  }, [content, highlightText]);

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
