import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Flame, Gem, Plus } from 'lucide-react';
import {
  getArticles,
  getCards,
  getProgress,
  getQuizQuestions,
  getRewards,
  getTotalPoints,
  getArticlesCacheSnapshot,
} from '../services/dataService';
import { LearningPath } from '../components/LearningPath';
import { generateLearningPath, type PathNode } from '../utils/pathGenerator';
import type { ArticleWithProgress, Card, LearningProgress, QuizQuestion } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getStreakDays } from '../utils/streak';

interface HomeProps {
  onSelectArticle: (id: string) => void;
  onCreate: () => void;
  onOpenNode?: (node: PathNode, articleId: string) => void;
  onCurrentArticleChange?: (id: string) => void;
}

function getArticleActivityTime(article: ArticleWithProgress): number {
  const createdAt = new Date(article.created_at).getTime();
  const lastReadAt = article.progress?.last_read_at
    ? new Date(article.progress.last_read_at).getTime()
    : 0;
  return Math.max(createdAt, lastReadAt);
}

function getDefaultArticleId(articles: ArticleWithProgress[]): string | null {
  if (articles.length === 0) return null;
  const latest = articles.reduce((acc, article) => {
    return getArticleActivityTime(article) > getArticleActivityTime(acc) ? article : acc;
  }, articles[0]);
  return latest.id;
}

export function Home({ onSelectArticle, onCreate, onOpenNode, onCurrentArticleChange }: HomeProps) {
  const { user } = useAuth();
  const cachedArticles = getArticlesCacheSnapshot();
  const [articles, setArticles] = useState<ArticleWithProgress[]>(cachedArticles || []);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    cachedArticles ? getDefaultArticleId(cachedArticles) : null
  );
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(!cachedArticles);
  const [showDropdown, setShowDropdown] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [claimedMilestones, setClaimedMilestones] = useState<number[]>([]);
  const [pathNodes, setPathNodes] = useState<PathNode[]>([]);
  const [isPathLoading, setIsPathLoading] = useState(false);
  const [streakDays, setStreakDays] = useState(() => getStreakDays());

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId) || null,
    [articles, selectedArticleId]
  );

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [articlesData, points] = await Promise.all([getArticles(), getTotalPoints()]);
        setArticles(articlesData);
        setTotalPoints(points);
        setSelectedArticleId((current) => {
          if (current && articlesData.some((article) => article.id === current)) {
            return current;
          }
          return getDefaultArticleId(articlesData);
        });
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  useEffect(() => {
    const syncStreak = () => setStreakDays(getStreakDays());
    window.addEventListener('streak:update', syncStreak);
    window.addEventListener('focus', syncStreak);
    return () => {
      window.removeEventListener('streak:update', syncStreak);
      window.removeEventListener('focus', syncStreak);
    };
  }, []);

  useEffect(() => {
    if (!selectedArticleId) return;
    onCurrentArticleChange?.(selectedArticleId);

    const loadPathData = async () => {
      setIsPathLoading(true);
      try {
        const [cardsData, quizData, progressData, rewardData] = await Promise.all([
          getCards(selectedArticleId),
          getQuizQuestions(selectedArticleId),
          getProgress(selectedArticleId),
          getRewards(selectedArticleId),
        ]);
        setCards(cardsData);
        setQuizzes(quizData);
        setProgress(progressData);
        setClaimedMilestones(rewardData.map((reward) => reward.milestone));
      } catch (error) {
        console.error('Failed to load path data:', error);
      } finally {
        setIsPathLoading(false);
      }
    };

    loadPathData();
  }, [selectedArticleId]);

  useEffect(() => {
    const nodes = generateLearningPath({
      cards,
      quizzes,
      progress,
      claimedMilestones,
    });
    setPathNodes(nodes);
  }, [cards, quizzes, progress, claimedMilestones]);

  const handleSelectArticle = (id: string) => {
    setSelectedArticleId(id);
    setShowDropdown(false);
  };

  const handleNodeClick = (node: PathNode) => {
    if (!selectedArticleId) return;
    if (node.status === 'locked') return;
    if (onOpenNode) {
      onOpenNode(node, selectedArticleId);
      return;
    }
    onSelectArticle(selectedArticleId);
  };

  if (isLoading && articles.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        <header className="flex items-center justify-between gap-4">
          <div className="relative">
            <button
              onClick={() => setShowDropdown((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-2xl shadow-sm border border-slate-100"
            >
              <div>
                <p className="text-xs text-slate-400">当前文章</p>
                <p className="text-sm font-semibold text-slate-800 font-display max-w-[180px] truncate">
                  {selectedArticle?.title || '请选择文章'}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>
            {showDropdown && (
              <div className="absolute mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-lg z-20 overflow-hidden">
                {articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => handleSelectArticle(article.id)}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {article.title}
                  </button>
                ))}
                {articles.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-400">暂无文章</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-100 px-3 py-2 rounded-2xl shadow-sm">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-slate-700">{streakDays} 天</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-100 px-3 py-2 rounded-2xl shadow-sm">
              <Gem className="w-4 h-4 text-secondary" />
              <span className="text-sm font-semibold text-slate-700">{totalPoints}</span>
            </div>
          </div>
        </header>

        {articles.length === 0 ? (
          <div className="mt-16 text-center bg-white border border-dashed border-slate-200 rounded-3xl p-10">
            <p className="text-lg font-semibold text-slate-700">导入你的第一篇文章</p>
            <p className="text-sm text-slate-400 mt-2">支持粘贴、上传 PDF 或 AI 生成</p>
            <button
              onClick={onCreate}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-secondary text-white rounded-2xl shadow-[0_6px_0_0_#245aa3] active:translate-y-1"
            >
              <Plus className="w-4 h-4" />
              立即开始
            </button>
          </div>
        ) : (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 font-display">学习路径</h2>
                <p className="text-sm text-slate-400">每完成 5 张卡片解锁一次测验</p>
              </div>
              <button
                onClick={() => selectedArticleId && onSelectArticle(selectedArticleId)}
                className="text-sm font-semibold text-secondary"
              >
                查看详情
              </button>
            </div>

            {isPathLoading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="mt-3 text-sm text-slate-400">正在生成路径...</p>
              </div>
            ) : cards.length === 0 ? (
              <div className="bg-white border border-slate-100 rounded-3xl p-6 text-center">
                <p className="text-base font-semibold text-slate-700">还没有生成学习卡片</p>
                <p className="text-sm text-slate-400 mt-2">先在新建页导入文章并生成卡片</p>
                <button
                  onClick={onCreate}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded-2xl shadow-[0_4px_0_0_#46a302] active:translate-y-1"
                >
                  去生成
                </button>
              </div>
            ) : (
              <LearningPath nodes={pathNodes} onNodeClick={handleNodeClick} />
            )}
          </section>
        )}
      </div>

      <button
        onClick={onCreate}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-2xl bg-secondary text-white shadow-[0_8px_0_0_#245aa3] flex items-center justify-center active:translate-y-1"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
