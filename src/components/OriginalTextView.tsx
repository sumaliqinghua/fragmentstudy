import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, Highlighter, Underline, Bold, MessageCircleQuestion, Check, Loader2, History, ChevronDown, ChevronUp } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { Card, ArticleTextAnnotation, ArticleTextQA } from '../types';
import {
  getArticleTextAnnotations,
  createArticleTextAnnotation,
  deleteArticleTextAnnotation,
  getArticleTextQAs,
  getArticleTextQAsByRange,
  saveArticleTextQA,
} from '../services/dataService';
import { answerArticleTextQuestion, isConfigured } from '../services/openai';

interface OriginalTextViewProps {
  isOpen: boolean;
  articleId: string;
  originalContent: string;
  currentCard?: Card | null;
  allCards?: Card[];
  currentText?: string;
  onClose: () => void;
  onJumpToCard?: (index: number) => void;
}

interface TextSelection {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

interface QARange {
  startOffset: number;
  endOffset: number;
  count: number;
}

const ANNOTATION_STYLES = {
  highlight: { color: '#fef08a', label: '高亮' },
  underline: { color: '#93c5fd', label: '下划线' },
  bold: { color: '#fca5a5', label: '加粗' },
};

export function OriginalTextView({
  isOpen,
  articleId,
  originalContent,
  currentCard,
  currentText,
  onClose,
}: OriginalTextViewProps) {
  const [highlightText, setHighlightText] = useState<string>('');
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [annotations, setAnnotations] = useState<ArticleTextAnnotation[]>([]);
  const [qaRanges, setQaRanges] = useState<QARange[]>([]);
  const [showAskAI, setShowAskAI] = useState(false);
  const [includeFullArticle, setIncludeFullArticle] = useState(true);
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewingQAHistory, setViewingQAHistory] = useState<{ startOffset: number; endOffset: number; records: ArticleTextQA[] } | null>(null);
  const [expandedQAId, setExpandedQAId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const textToHighlight = currentText || currentCard?.content?.trim() || '';
    setHighlightText(textToHighlight);
  }, [isOpen, currentCard, currentText]);

  useEffect(() => {
    if (!isOpen || !contentRef.current || !highlightText) return;
    const timer = setTimeout(() => {
      const highlightEl = contentRef.current?.querySelector('[data-highlight="true"]');
      if (highlightEl) {
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen, highlightText]);

  useEffect(() => {
    if (!isOpen || !articleId) return;
    loadAnnotations();
    loadQARecords();
  }, [isOpen, articleId]);

  const loadAnnotations = async () => {
    try {
      const data = await getArticleTextAnnotations(articleId);
      setAnnotations(data);
    } catch (err) {
      console.error('Failed to load annotations:', err);
    }
  };

  const loadQARecords = async () => {
    try {
      const data = await getArticleTextQAs(articleId);
      const ranges: QARange[] = [];
      const rangeMap = new Map<string, number>();
      for (const qa of data) {
        const key = `${qa.start_offset}-${qa.end_offset}`;
        rangeMap.set(key, (rangeMap.get(key) || 0) + 1);
      }
      for (const [key, count] of rangeMap) {
        const [start, end] = key.split('-').map(Number);
        ranges.push({ startOffset: start, endOffset: end, count });
      }
      setQaRanges(ranges);
    } catch (err) {
      console.error('Failed to load QA records:', err);
    }
  };

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) {
      if (!showAskAI) {
        setSelection(null);
      }
      return;
    }

    const selectedText = sel.toString().trim();
    if (!selectedText) {
      if (!showAskAI) {
        setSelection(null);
      }
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = contentRef.current.getBoundingClientRect();
    const scrollTop = contentRef.current.scrollTop;

    const plainContent = originalContent.replace(/[#*_`~[\]()>-]/g, '');
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
        top: rect.top - containerRect.top + scrollTop,
        left: rect.left - containerRect.left,
      } as DOMRect,
    });
    setShowAskAI(false);
    setViewingQAHistory(null);
  }, [originalContent, showAskAI]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
      return;
    }
    if (!showAskAI) {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelection(null);
      }
    }
  }, [showAskAI]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, handleClickOutside]);

  const handleCreateAnnotation = async (style: 'highlight' | 'underline' | 'bold') => {
    if (!selection) return;
    try {
      await createArticleTextAnnotation(
        articleId,
        selection.text,
        selection.startOffset,
        selection.endOffset,
        style,
        ANNOTATION_STYLES[style].color
      );
      await loadAnnotations();
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error('Failed to create annotation:', err);
    }
  };

  const handleDeleteAnnotation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteArticleTextAnnotation(id);
      await loadAnnotations();
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  };

  const handleScrollToAnnotation = (ann: ArticleTextAnnotation) => {
    if (!contentRef.current) return;
    const span = contentRef.current.querySelector(`[data-annotation-id="${ann.id}"]`) as HTMLElement;
    if (span) {
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      span.style.outline = '2px solid #14b8a6';
      span.style.outlineOffset = '2px';
      setTimeout(() => {
        span.style.outline = '';
        span.style.outlineOffset = '';
      }, 2000);
    }
  };

  const handleAskAI = async () => {
    if (!selection || !question.trim()) return;
    if (!isConfigured()) {
      alert('请先在设置中配置 API Key');
      return;
    }

    setIsLoading(true);
    setAiResponse('');

    try {
      const generator = answerArticleTextQuestion(
        selection.text,
        question,
        includeFullArticle ? originalContent : undefined
      );

      let fullResponse = '';
      for await (const chunk of generator) {
        fullResponse += chunk;
        setAiResponse(fullResponse);
      }

      await saveArticleTextQA(
        articleId,
        selection.text,
        selection.startOffset,
        selection.endOffset,
        question,
        fullResponse,
        includeFullArticle
      );

      await loadQARecords();
      setQuestion('');
    } catch (err) {
      console.error('Failed to ask AI:', err);
      setAiResponse('请求失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewQAHistory = async (startOffset: number, endOffset: number) => {
    try {
      const records = await getArticleTextQAsByRange(articleId, startOffset, endOffset);
      setViewingQAHistory({ startOffset, endOffset, records });
      setSelection(null);
    } catch (err) {
      console.error('Failed to load QA history:', err);
    }
  };

  const renderAnnotatedContent = () => {
    if (annotations.length === 0 && qaRanges.length === 0) {
      return (
        <MarkdownRenderer
          content={originalContent}
          highlightText={highlightText}
          className="text-base"
        />
      );
    }

    const plainContent = originalContent.replace(/[#*_`~[\]()>-]/g, '');
    const allMarkers: { offset: number; type: 'start' | 'end'; annotation?: ArticleTextAnnotation; qaRange?: QARange }[] = [];

    for (const ann of annotations) {
      allMarkers.push({ offset: ann.start_offset, type: 'start', annotation: ann });
      allMarkers.push({ offset: ann.end_offset, type: 'end', annotation: ann });
    }

    for (const range of qaRanges) {
      allMarkers.push({ offset: range.startOffset, type: 'start', qaRange: range });
      allMarkers.push({ offset: range.endOffset, type: 'end', qaRange: range });
    }

    allMarkers.sort((a, b) => {
      if (a.offset !== b.offset) return a.offset - b.offset;
      return a.type === 'end' ? -1 : 1;
    });

    const parts: React.ReactNode[] = [];
    let lastOffset = 0;
    const activeAnnotations: ArticleTextAnnotation[] = [];
    const activeQARanges: QARange[] = [];

    for (const marker of allMarkers) {
      if (marker.offset > lastOffset) {
        const text = plainContent.slice(lastOffset, marker.offset);
        if (activeAnnotations.length > 0 || activeQARanges.length > 0) {
          const topAnnotation = activeAnnotations[activeAnnotations.length - 1];
          const hasQA = activeQARanges.length > 0;
          const style: React.CSSProperties = {};

          if (topAnnotation) {
            if (topAnnotation.style === 'highlight') {
              style.backgroundColor = topAnnotation.color;
              style.padding = '2px 4px';
              style.borderRadius = '3px';
            } else if (topAnnotation.style === 'underline') {
              style.borderBottom = `3px solid ${topAnnotation.color}`;
              style.paddingBottom = '2px';
            } else if (topAnnotation.style === 'bold') {
              style.fontWeight = 700;
              style.color = '#dc2626';
            }
          }

          if (hasQA) {
            style.borderBottom = style.borderBottom || '2px dashed #10b981';
            style.cursor = 'pointer';
          }

          const qaRange = activeQARanges[activeQARanges.length - 1];

          parts.push(
            <span
              key={`${lastOffset}-${marker.offset}`}
              style={style}
              onClick={hasQA && qaRange ? () => handleViewQAHistory(qaRange.startOffset, qaRange.endOffset) : undefined}
              title={hasQA && qaRange ? `${qaRange.count} 条提问记录，点击查看` : undefined}
              className={`${hasQA ? 'relative group' : ''} transition-all duration-300`}
              data-annotation-id={topAnnotation?.id}
            >
              {text}
              {hasQA && qaRange && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {qaRange.count}
                </span>
              )}
            </span>
          );
        } else {
          parts.push(<span key={`${lastOffset}-${marker.offset}`}>{text}</span>);
        }
      }

      if (marker.type === 'start') {
        if (marker.annotation) activeAnnotations.push(marker.annotation);
        if (marker.qaRange) activeQARanges.push(marker.qaRange);
      } else {
        if (marker.annotation) {
          const idx = activeAnnotations.findIndex(a => a.id === marker.annotation!.id);
          if (idx !== -1) activeAnnotations.splice(idx, 1);
        }
        if (marker.qaRange) {
          const idx = activeQARanges.findIndex(r => r.startOffset === marker.qaRange!.startOffset && r.endOffset === marker.qaRange!.endOffset);
          if (idx !== -1) activeQARanges.splice(idx, 1);
        }
      }

      lastOffset = marker.offset;
    }

    if (lastOffset < plainContent.length) {
      parts.push(<span key={`${lastOffset}-end`}>{plainContent.slice(lastOffset)}</span>);
    }

    return <div className="prose prose-sm max-w-none whitespace-pre-wrap">{parts}</div>;
  };

  if (!isOpen) return null;

  const displayText = currentText || currentCard?.content || '';

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">原文阅读</h2>
      </div>

      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-5 py-6 relative"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        <div className="max-w-2xl mx-auto">
          {renderAnnotatedContent()}
        </div>

        {selection && !showAskAI && !viewingQAHistory && (
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
              className="p-2 hover:bg-yellow-50 rounded-lg transition-colors group relative"
              title="高亮"
            >
              <Highlighter className="w-5 h-5 text-yellow-500" />
            </button>
            <button
              onClick={() => handleCreateAnnotation('underline')}
              className="p-2 hover:bg-blue-50 rounded-lg transition-colors group relative"
              title="下划线"
            >
              <Underline className="w-5 h-5 text-blue-500" />
            </button>
            <button
              onClick={() => handleCreateAnnotation('bold')}
              className="p-2 hover:bg-red-50 rounded-lg transition-colors group relative"
              title="加粗"
            >
              <Bold className="w-5 h-5 text-red-500" />
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1" />
            <button
              onClick={() => setShowAskAI(true)}
              className="p-2 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1"
              title="问 AI"
            >
              <MessageCircleQuestion className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-emerald-600 font-medium">问 AI</span>
            </button>
          </div>
        )}

        {selection && showAskAI && (
          <div
            ref={toolbarRef}
            className="absolute bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-10 w-80 max-w-[calc(100%-20px)]"
            style={{
              top: Math.max(selection.rect.top - 10, 10),
              left: Math.max(Math.min(selection.rect.left, (contentRef.current?.clientWidth || 400) - 330), 10),
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">问 AI</h3>
              <button
                onClick={() => {
                  setShowAskAI(false);
                  setAiResponse('');
                  setQuestion('');
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">选中的文字：</p>
              <p className="text-sm text-gray-700 line-clamp-2">"{selection.text}"</p>
            </div>

            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeFullArticle}
                onChange={(e) => setIncludeFullArticle(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-600">包含整篇文章作为上下文</span>
            </label>

            <div className="mb-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="输入你的问题..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAskAI()}
              />
            </div>

            <button
              onClick={handleAskAI}
              disabled={isLoading || !question.trim()}
              className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  思考中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  提问
                </>
              )}
            </button>

            {aiResponse && (
              <div className="mt-3 p-3 bg-emerald-50 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResponse}</p>
              </div>
            )}
          </div>
        )}

        {viewingQAHistory && (
          <div className="fixed inset-0 bg-black/50 z-20 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">提问记录</h3>
                  <span className="text-sm text-gray-500">({viewingQAHistory.records.length} 条)</span>
                </div>
                <button
                  onClick={() => setViewingQAHistory(null)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-4 bg-gray-50 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-1">相关文字：</p>
                <p className="text-sm text-gray-700">
                  "{viewingQAHistory.records[0]?.selected_text}"
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {viewingQAHistory.records.map((qa) => (
                  <div key={qa.id} className="bg-gray-50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedQAId(expandedQAId === qa.id ? null : qa.id)}
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{qa.question}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(qa.created_at).toLocaleString('zh-CN')}
                          {qa.include_full_article && ' · 含全文上下文'}
                        </p>
                      </div>
                      {expandedQAId === qa.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                    </button>
                    {expandedQAId === qa.id && (
                      <div className="px-3 pb-3 border-t border-gray-200">
                        <div className="mt-3 p-3 bg-white rounded-lg">
                          <p className="text-xs text-emerald-600 font-medium mb-2">AI 回答：</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{qa.answer}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {displayText && (
        <div className="shrink-0 bg-gray-50 border-t border-gray-200 p-4">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs text-gray-500 mb-2">当前内容</p>
            <p className="text-sm text-gray-700 line-clamp-2">{displayText}</p>
          </div>
        </div>
      )}

      {annotations.length > 0 && (
        <div className="shrink-0 bg-white border-t border-gray-100 p-3">
          <div className="max-w-2xl mx-auto">
            <p className="text-xs text-gray-500 mb-2">标注 ({annotations.length}) - 点击定位</p>
            <div className="flex flex-wrap gap-2">
              {annotations.slice(0, 5).map((ann) => (
                <button
                  key={ann.id}
                  onClick={() => handleScrollToAnnotation(ann)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 hover:bg-teal-50 hover:text-teal-700 transition-colors group"
                  title="点击定位到标注"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ann.color }}
                  />
                  <span className="truncate max-w-20">{ann.text}</span>
                  <span
                    onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                    className="ml-1 p-0.5 hover:bg-red-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </span>
                </button>
              ))}
              {annotations.length > 5 && (
                <span className="text-xs text-gray-400 px-2 py-1">
                  +{annotations.length - 5} 更多
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
