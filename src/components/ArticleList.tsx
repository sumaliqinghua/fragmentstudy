import { BookOpen, Trash2, Layers, Clock, MessageCircle, Tv, HelpCircle } from 'lucide-react';
import type { ArticleWithProgress } from '../types';

interface ArticleListProps {
  articles: ArticleWithProgress[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ArticleList({ articles, onSelect, onDelete }: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">还没有文章</h3>
        <p className="text-gray-500">点击上方按钮导入你的第一篇文章</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {articles.map((article) => {
        const progress = article.progress;
        const cardCount = article.cardCount || 0;
        const dialogueCount = article.messageCount || 0;
        const galgameCount = article.galgameMessageCount || 0;
        const quizCount = article.quizCount || 0;
        const progressPercent = progress && progress.total_count > 0
          ? Math.round((progress.completed_count / progress.total_count) * 100)
          : 0;

        return (
          <div
            key={article.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => onSelect(article.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-teal-600 transition-colors">
                    {article.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    {cardCount} 张卡片
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4" />
                    {dialogueCount} 条对话
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Tv className="w-4 h-4" />
                    {galgameCount} 句台词
                  </span>
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" />
                    {quizCount} 道题
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {new Date(article.created_at).toLocaleDateString()}
                  </span>
                </div>

                {cardCount > 0 && progress && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-500">学习进度</span>
                      <span className="font-medium text-teal-600">{progressPercent}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(article.id);
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
