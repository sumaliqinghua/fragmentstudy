import { FileText, Bookmark, BookmarkCheck, MessageCircle, X } from 'lucide-react';

interface ActionMenuProps {
  isOpen: boolean;
  isBookmarked: boolean;
  onClose: () => void;
  onViewOriginal: () => void;
  onToggleBookmark: () => void;
  onAskAI: () => void;
}

export function ActionMenu({
  isOpen,
  isBookmarked,
  onClose,
  onViewOriginal,
  onToggleBookmark,
  onAskAI,
}: ActionMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />

      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 pb-8 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">操作</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={onViewOriginal}
            className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors group"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-7 h-7 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">跳转原文</span>
          </button>

          <button
            onClick={onToggleBookmark}
            className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors group"
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
              isBookmarked ? 'bg-amber-100' : 'bg-gray-100'
            }`}>
              {isBookmarked ? (
                <BookmarkCheck className="w-7 h-7 text-amber-600" />
              ) : (
                <Bookmark className="w-7 h-7 text-gray-600" />
              )}
            </div>
            <span className="text-sm font-medium text-gray-700">
              {isBookmarked ? '已标记' : '标记重要'}
            </span>
          </button>

          <button
            onClick={onAskAI}
            className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors group"
          >
            <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageCircle className="w-7 h-7 text-teal-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">问 AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}
