import { useState, useRef, useCallback, useEffect } from 'react';
import { Highlighter, Underline, Bold, StickyNote, ChevronLeft, ChevronRight } from 'lucide-react';
import { createHighlight, getCardNote, upsertCardNote } from '../services/dataService';
import type { Card, Highlight, CardNote } from '../types';

interface CardStackProps {
  cards: Card[];
  currentIndex: number;
  highlights: Highlight[];
  onNext: () => void;
  onPrev: () => void;
  onLongPress: () => void;
  onHighlightAdded: (highlight: Highlight) => void;
}

interface SelectionInfo {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: { top: number; left: number };
}

const HIGHLIGHT_COLORS = {
  highlight: '#fef08a',
  underline: '#93c5fd',
  bold: '#fca5a5',
};

export function CardStack({
  cards,
  currentIndex,
  highlights,
  onNext,
  onPrev,
  onLongPress,
  onHighlightAdded,
}: CardStackProps) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [isCreatingHighlight, setIsCreatingHighlight] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [currentNote, setCurrentNote] = useState<CardNote | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];
  const prevCard = cards[currentIndex - 1];

  useEffect(() => {
    if (currentCard) {
      getCardNote(currentCard.id).then(note => {
        setCurrentNote(note);
        setNoteContent(note?.content || '');
      });
    }
  }, [currentCard?.id]);

  const handleTextSelection = useCallback(() => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed || !contentRef.current) {
      setSelection(null);
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText) {
      setSelection(null);
      return;
    }

    const range = windowSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = cardRef.current?.getBoundingClientRect();

    if (!containerRect) return;

    const content = currentCard?.content || '';
    const startOffset = content.indexOf(selectedText);
    if (startOffset === -1) return;

    setSelection({
      text: selectedText,
      startOffset,
      endOffset: startOffset + selectedText.length,
      rect: {
        top: rect.top - containerRect.top - 50,
        left: rect.left - containerRect.left + rect.width / 2,
      },
    });
  }, [currentCard]);

  const handleCreateHighlight = async (style: 'highlight' | 'underline' | 'bold') => {
    if (!selection || !currentCard || isCreatingHighlight) return;

    setIsCreatingHighlight(true);
    try {
      const highlight = await createHighlight(
        currentCard.id,
        selection.text,
        selection.startOffset,
        selection.endOffset,
        style,
        HIGHLIGHT_COLORS[style]
      );
      onHighlightAdded(highlight);
      window.getSelection()?.removeAllRanges();
      setSelection(null);
    } catch (error) {
      console.error('Failed to create highlight:', error);
    } finally {
      setIsCreatingHighlight(false);
    }
  };

  const handleSaveNote = async () => {
    if (!currentCard || isSavingNote) return;

    setIsSavingNote(true);
    try {
      const note = await upsertCardNote(currentCard.id, noteContent);
      setCurrentNote(note);
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleEdgeTouchStart = useCallback((direction: 'left' | 'right') => {
    longPressTimer.current = setTimeout(() => {
      onLongPress();
    }, 500);
  }, [onLongPress]);

  const handleEdgeTouchEnd = useCallback((direction: 'left' | 'right') => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (direction === 'left') {
      onPrev();
    } else {
      onNext();
    }
  }, [onPrev, onNext]);

  const handleEdgeTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (selection &&
          !contentRef.current?.contains(target) &&
          !toolbarRef.current?.contains(target)) {
        setSelection(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selection]);

  useEffect(() => {
    setSelection(null);
    setShowNotes(false);
  }, [currentIndex]);

  const renderHighlightedContent = () => {
    if (!currentCard) return null;

    const content = currentCard.content;
    if (highlights.length === 0) {
      return <span>{content}</span>;
    }

    const sortedHighlights = [...highlights].sort((a, b) => a.start_offset - b.start_offset);
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach((h, idx) => {
      if (h.start_offset > lastIndex) {
        parts.push(<span key={`text-${idx}`}>{content.slice(lastIndex, h.start_offset)}</span>);
      }

      const highlightedText = content.slice(h.start_offset, h.end_offset);
      let style: React.CSSProperties = {};

      if (h.style === 'highlight') {
        style = {
          backgroundColor: h.color,
          padding: '2px 4px',
          borderRadius: '3px',
          boxDecorationBreak: 'clone',
        };
      } else if (h.style === 'underline') {
        style = {
          borderBottom: `3px solid ${h.color}`,
          paddingBottom: '2px',
        };
      } else if (h.style === 'bold') {
        style = {
          fontWeight: 700,
          color: '#dc2626',
        };
      }

      parts.push(
        <span key={`highlight-${idx}`} style={style}>
          {highlightedText}
        </span>
      );
      lastIndex = h.end_offset;
    });

    if (lastIndex < content.length) {
      parts.push(<span key="text-end">{content.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  if (!currentCard) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">没有卡片</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-6 py-6">
      <div className="absolute w-[85%] h-[60%] bg-white rounded-3xl top-[54%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40 scale-90 border border-slate-200 shadow-sm" />
      <div className="absolute w-[90%] h-[65%] bg-white rounded-3xl top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-70 scale-95 shadow-md border border-slate-200" />

      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-sm aspect-[4/5] bg-white rounded-3xl shadow-xl flex flex-col overflow-hidden border border-slate-100"
      >
        {prevCard && (
          <button
            onTouchStart={() => handleEdgeTouchStart('left')}
            onTouchEnd={() => handleEdgeTouchEnd('left')}
            onTouchCancel={handleEdgeTouchCancel}
            onClick={onPrev}
            className="absolute left-0 top-0 bottom-0 w-12 z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-slate-100/80 to-transparent"
          >
            <ChevronLeft className="w-6 h-6 text-slate-400" />
          </button>
        )}

        {nextCard && (
          <button
            onTouchStart={() => handleEdgeTouchStart('right')}
            onTouchEnd={() => handleEdgeTouchEnd('right')}
            onTouchCancel={handleEdgeTouchCancel}
            onClick={onNext}
            className="absolute right-0 top-0 bottom-0 w-12 z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-l from-slate-100/80 to-transparent"
          >
            <ChevronRight className="w-6 h-6 text-slate-400" />
          </button>
        )}

        <div className="px-6 pt-6 flex justify-between items-start">
          {currentCard.semantic_label && (
            <span className="bg-secondary/10 text-secondary px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider">
              {currentCard.semantic_label}
            </span>
          )}
        </div>

        <div
          ref={contentRef}
          className="flex-1 px-8 py-4 overflow-y-auto select-text"
          onMouseUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
        >
          <p className="text-gray-800 text-xl leading-relaxed whitespace-pre-wrap break-words text-center">
            {renderHighlightedContent()}
          </p>
        </div>

        {selection && (
          <div
            ref={toolbarRef}
            className="absolute z-30 flex items-center gap-1 bg-gray-900 rounded-lg p-1.5 shadow-xl"
            style={{
              top: Math.max(selection.rect.top + 60, 70),
              left: Math.min(Math.max(selection.rect.left - 60, 10), 200),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => handleCreateHighlight('highlight')}
              disabled={isCreatingHighlight}
              className="p-2 hover:bg-gray-700 active:bg-gray-600 rounded-md transition-colors"
              title="荧光笔"
            >
              <Highlighter className="w-4 h-4 text-yellow-400" />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => handleCreateHighlight('underline')}
              disabled={isCreatingHighlight}
              className="p-2 hover:bg-gray-700 active:bg-gray-600 rounded-md transition-colors"
              title="划线"
            >
              <Underline className="w-4 h-4 text-blue-400" />
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => handleCreateHighlight('bold')}
              disabled={isCreatingHighlight}
              className="p-2 hover:bg-gray-700 active:bg-gray-600 rounded-md transition-colors"
              title="加粗"
            >
              <Bold className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl transition-colors ${
              showNotes ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <StickyNote className="w-4 h-4" />
            <span className="text-sm font-medium">
              {currentNote?.content ? '查看笔记' : '添加笔记'}
            </span>
          </button>

          {showNotes && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                onBlur={handleSaveNote}
                placeholder="记录你的想法..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">
                  {isSavingNote ? '保存中...' : (currentNote ? '自动保存' : '')}
                </span>
                <button
                  onClick={handleSaveNote}
                  disabled={isSavingNote}
                  className="px-3 py-1 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 disabled:opacity-50 transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-400 text-center">
        点击两侧边缘切换卡片 | 选中文字可标记
      </div>
    </div>
  );
}
