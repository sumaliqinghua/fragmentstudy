import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Sparkles, Highlighter, Underline, Bold } from 'lucide-react';
import type { Article, ArticleTextAnnotation } from '../types';
import { createArticleTextAnnotation, getArticleTextAnnotations } from '../services/dataService';
import { MarkdownRenderer } from './MarkdownRenderer';

interface OriginalReaderProps {
  article: Article;
  onStartQuiz?: () => void;
  onScrollProgress?: (percent: number) => void;
}

export function OriginalReader({ article, onStartQuiz, onScrollProgress }: OriginalReaderProps) {
  const [selection, setSelection] = useState<{
    text: string;
    startOffset: number;
    endOffset: number;
    rect: DOMRect;
  } | null>(null);
  const [annotations, setAnnotations] = useState<ArticleTextAnnotation[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const firstImage = useMemo(() => {
    const match = article.original_content.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
    return match ? { markdown: match[0], url: match[1] } : null;
  }, [article.original_content]);
  const readerContent = useMemo(
    () => firstImage ? article.original_content.replace(firstImage.markdown, '') : article.original_content,
    [article.original_content, firstImage]
  );
  const plainContent = useMemo(
    () => readerContent
      .replace(/!\[([^\]]*)\]\(https?:\/\/[^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
      .replace(/[#*_`~[\]()>-]/g, ''),
    [readerContent]
  );

  useEffect(() => {
    const loadAnnotations = async () => {
      try {
        const data = await getArticleTextAnnotations(article.id);
        setAnnotations(data);
      } catch (error) {
        console.error('Failed to load annotations:', error);
      }
    };
    loadAnnotations();
  }, [article.id]);

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) {
      setSelection(null);
      return;
    }

    const selectedText = sel.toString().trim();
    if (!selectedText) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();

    let startOffset = plainContent.indexOf(selectedText);
    if (startOffset === -1) {
      const normalizedSelected = selectedText.replace(/\s+/g, ' ').trim();
      const normalizedContent = plainContent.replace(/\s+/g, ' ');
      const normalizedOffset = normalizedContent.indexOf(normalizedSelected);
      if (normalizedOffset !== -1) {
        let charCount = 0;
        let normalizedCharCount = 0;
        for (let i = 0; i < plainContent.length && normalizedCharCount < normalizedOffset; i++) {
          if (/\s/.test(plainContent[i])) {
            if (i === 0 || !/\s/.test(plainContent[i - 1])) {
              normalizedCharCount++;
            }
          } else {
            normalizedCharCount++;
          }
          charCount = i + 1;
        }
        startOffset = charCount;
      } else {
        startOffset = 0;
      }
    }

    setSelection({
      text: selectedText,
      startOffset,
      endOffset: startOffset + selectedText.length,
      rect: {
        ...rect,
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left,
      } as DOMRect,
    });
  }, [plainContent]);

  const handleCreateAnnotation = async (style: 'highlight' | 'underline' | 'bold') => {
    if (!selection) return;
    try {
      await createArticleTextAnnotation(
        article.id,
        selection.text,
        selection.startOffset,
        selection.endOffset,
        style,
        style === 'highlight' ? '#fef08a' : style === 'underline' ? '#93c5fd' : '#fca5a5'
      );
      const data = await getArticleTextAnnotations(article.id);
      setAnnotations(data);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      console.error('Failed to create annotation:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!onScrollProgress) return;
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const percent = total > 0 ? Math.round((window.scrollY / total) * 100) : 0;
      onScrollProgress(Math.min(100, Math.max(0, percent)));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [onScrollProgress]);

  const renderAnnotatedContent = () => {
    if (annotations.length === 0) {
      return <span>{plainContent}</span>;
    }

    const allMarkers: { offset: number; type: 'start' | 'end'; annotation: ArticleTextAnnotation }[] = [];
    for (const ann of annotations) {
      allMarkers.push({ offset: ann.start_offset, type: 'start', annotation: ann });
      allMarkers.push({ offset: ann.end_offset, type: 'end', annotation: ann });
    }
    allMarkers.sort((a, b) => {
      if (a.offset !== b.offset) return a.offset - b.offset;
      return a.type === 'end' ? -1 : 1;
    });

    const parts: React.ReactNode[] = [];
    let lastOffset = 0;
    const activeAnnotations: ArticleTextAnnotation[] = [];

    for (const marker of allMarkers) {
      if (marker.offset > lastOffset) {
        const text = plainContent.slice(lastOffset, marker.offset);
        if (activeAnnotations.length > 0) {
          const topAnnotation = activeAnnotations[activeAnnotations.length - 1];
          const style: React.CSSProperties = {};
          if (topAnnotation.style === 'highlight') {
            style.backgroundColor = topAnnotation.color;
            style.padding = '2px 4px';
            style.borderRadius = '3px';
            style.boxDecorationBreak = 'clone';
          } else if (topAnnotation.style === 'underline') {
            style.borderBottom = `3px solid ${topAnnotation.color}`;
            style.paddingBottom = '2px';
          } else if (topAnnotation.style === 'bold') {
            style.fontWeight = 700;
            style.color = '#dc2626';
          }
          parts.push(
            <span key={`${lastOffset}-${marker.offset}`} style={style}>
              {text}
            </span>
          );
        } else {
          parts.push(<span key={`${lastOffset}-${marker.offset}`}>{text}</span>);
        }
      }

      if (marker.type === 'start') {
        activeAnnotations.push(marker.annotation);
      } else {
        const idx = activeAnnotations.findIndex(a => a.id === marker.annotation.id);
        if (idx !== -1) activeAnnotations.splice(idx, 1);
      }
      lastOffset = marker.offset;
    }

    if (lastOffset < plainContent.length) {
      parts.push(<span key={`${lastOffset}-end`}>{plainContent.slice(lastOffset)}</span>);
    }

    return <>{parts}</>;
  };

  return (
    <div className="px-6 pb-24 max-w-md md:max-w-3xl lg:max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="w-full h-52 rounded-2xl overflow-hidden mb-6 shadow-sm border border-slate-100 bg-slate-100 flex items-center justify-center">
          {firstImage ? (
            <img src={firstImage.url} alt={article.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="w-16 h-16 text-slate-300" />
          )}
        </div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 mb-4 font-display">
          {article.title}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex h-7 items-center justify-center gap-x-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <p className="text-emerald-700 text-[11px] font-bold uppercase tracking-wider">Intermediate</p>
          </div>
          <div className="flex h-7 items-center justify-center gap-x-1.5 rounded-full bg-slate-50 border border-slate-200 px-3">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <p className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">5 min read</p>
          </div>
        </div>
      </div>

      <article
        ref={contentRef}
        className="space-y-6 relative"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        <div className="text-[20px] leading-[1.8] text-slate-700">
          {annotations.length === 0 ? (
            <MarkdownRenderer content={readerContent} className="original-markdown" />
          ) : (
            <div className="whitespace-pre-wrap">{renderAnnotatedContent()}</div>
          )}
        </div>

        <div className="mt-12 mb-8 p-6 rounded-2xl bg-slate-50 border-2 border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Comprehension Check</h3>
          <p className="text-slate-500 mb-6">Test your understanding of the material.</p>
          <button
            onClick={onStartQuiz}
            className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl shadow-[0_4px_0_0_#46a302] active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            Start Quiz
          </button>
        </div>
        {selection && (
          <div
            ref={toolbarRef}
            className="absolute bg-white rounded-xl shadow-lg border border-gray-200 p-2 flex items-center gap-1 z-10"
            style={{
              top: Math.max(selection.rect.top - 50, 10),
              left: Math.max(selection.rect.left, 10),
              maxWidth: 'calc(100% - 20px)',
            }}
          >
            <button
              onClick={() => handleCreateAnnotation('highlight')}
              className="p-2 hover:bg-yellow-50 rounded-lg transition-colors"
              title="高亮"
            >
              <Highlighter className="w-5 h-5 text-yellow-500" />
            </button>
            <button
              onClick={() => handleCreateAnnotation('underline')}
              className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
              title="下划线"
            >
              <Underline className="w-5 h-5 text-blue-500" />
            </button>
            <button
              onClick={() => handleCreateAnnotation('bold')}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
              title="加粗"
            >
              <Bold className="w-5 h-5 text-red-500" />
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
