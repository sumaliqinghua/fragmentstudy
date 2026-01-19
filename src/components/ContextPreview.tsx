import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Card } from '../types';

interface ContextPreviewProps {
  isOpen: boolean;
  currentCard: Card | null;
  prevCard: Card | null;
  nextCard: Card | null;
  onClose: () => void;
}

export function ContextPreview({
  isOpen,
  currentCard,
  prevCard,
  nextCard,
  onClose,
}: ContextPreviewProps) {
  if (!isOpen || !currentCard) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">上下文预览</h3>
          <p className="text-sm text-gray-500 mt-1">{currentCard.context_summary || '查看前后卡片内容'}</p>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {prevCard && (
            <div className="p-5 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <ChevronUp className="w-4 h-4" />
                上一张卡片
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{prevCard.content}</p>
            </div>
          )}

          <div className="p-5 bg-teal-50 border-l-4 border-teal-500">
            <div className="flex items-center gap-2 text-sm text-teal-600 mb-2 font-medium">
              当前卡片
              {currentCard.semantic_label && (
                <span className="px-2 py-0.5 bg-teal-100 rounded-full text-xs">
                  {currentCard.semantic_label}
                </span>
              )}
            </div>
            <p className="text-gray-800 leading-relaxed">{currentCard.content}</p>
          </div>

          {nextCard && (
            <div className="p-5 bg-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <ChevronDown className="w-4 h-4" />
                下一张卡片
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{nextCard.content}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
