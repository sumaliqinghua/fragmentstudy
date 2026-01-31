import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Flame, Gem, Plus } from 'lucide-react';
import {
  getArticles,
  getCards,
  getCardsCacheSnapshot,
  getProgress,
  getProgressCacheSnapshot,
  getQuizCacheSnapshot,
  getQuizQuestions,
  getRewards,
  getRewardsCacheSnapshot,
  getTotalPoints,
  getArticlesCacheSnapshot,
  getTags,
} from '../services/dataService';
import { LearningPath } from '../components/LearningPath';
import { generateLearningPath, type PathNode } from '../utils/pathGenerator';
import type { ArticleWithProgress, Card, LearningProgress, QuizQuestion, Tag } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getStreakDays } from '../utils/streak';

const UNCATEGORIZED_TAG_ID = 'uncategorized';

interface HomeProps {
  onSelectArticle: (id: string) => void;
  onCreate: () => void;
  onOpenNode?: (node: PathNode, articleId: string) => void;
  onCurrentArticleChange?: (id: string) => void;
  isActive?: boolean;
  activeArticleId?: string | null;
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

export function Home({
  onSelectArticle,
  onCreate,
  onOpenNode,
  onCurrentArticleChange,
  isActive = true,
  activeArticleId,
}: HomeProps) {
  const { user } = useAuth();
  const cachedArticles = getArticlesCacheSnapshot();
  const [articles, setArticles] = useState<ArticleWithProgress[]>(cachedArticles || []);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    cachedArticles ? getDefaultArticleId(cachedArticles) : null
  );
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(!cachedArticles);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
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

  const tagsById = useMemo(() => new Map(tags.map(tag => [tag.id, tag])), [tags]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Tag[]>();
    for (const tag of tags) {
      const key = tag.parent_id ?? null;
      const list = map.get(key) || [];
      list.push(tag);
      map.set(key, list);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
      map.set(key, list);
    }
    return map;
  }, [tags]);

  const descendantMap = useMemo(() => {
    const cache = new Map<string, Set<string>>();
    const build = (tagId: string): Set<string> => {
      if (cache.has(tagId)) return cache.get(tagId)!;
      const set = new Set<string>([tagId]);
      const children = childrenByParent.get(tagId) || [];
      for (const child of children) {
        for (const id of build(child.id)) {
          set.add(id);
        }
      }
      cache.set(tagId, set);
      return set;
    };
    tags.forEach(tag => build(tag.id));
    return cache;
  }, [tags, childrenByParent]);

  const filteredArticles = useMemo(() => {
    if (!selectedTagId) return articles;
    if (selectedTagId === UNCATEGORIZED_TAG_ID) {
      return articles.filter(article => (article.tagIds || []).length === 0);
    }
    const descendants = descendantMap.get(selectedTagId) || new Set([selectedTagId]);
    return articles.filter(article => (article.tagIds || []).some(tagId => descendants.has(tagId)));
  }, [articles, selectedTagId, descendantMap]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of tags) {
      counts.set(tag.id, 0);
    }
    for (const tag of tags) {
      const descendants = descendantMap.get(tag.id) || new Set([tag.id]);
      let count = 0;
      for (const article of articles) {
        const tagIds = article.tagIds || [];
        if (tagIds.some(tagId => descendants.has(tagId))) {
          count += 1;
        }
      }
      counts.set(tag.id, count);
    }
    return counts;
  }, [tags, articles, descendantMap]);

  const uncategorizedCount = useMemo(
    () => articles.filter(article => (article.tagIds || []).length === 0).length,
    [articles]
  );

  const loadHomeData = async () => {
    setIsLoading(true);
    try {
      const [articlesData, points] = await Promise.all([getArticles(), getTotalPoints()]);
      setArticles(articlesData);
      setTotalPoints(points);
      setSelectedArticleId((current) => {
        const preferred = activeArticleId && articlesData.some((article) => article.id === activeArticleId)
          ? activeArticleId
          : current;
        if (preferred && articlesData.some((article) => article.id === preferred)) {
          return preferred;
        }
        return getDefaultArticleId(articlesData);
      });
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHomeData();
  }, [user]);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tagsData = await getTags();
        setTags(tagsData);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };
    loadTags();
  }, [user]);

  useEffect(() => {
    if (filteredArticles.length === 0) {
      if (selectedArticleId !== null) {
        setSelectedArticleId(null);
      }
      return;
    }
    const currentCandidate = selectedArticleId && filteredArticles.some(article => article.id === selectedArticleId)
      ? selectedArticleId
      : null;
    if (currentCandidate) {
      return;
    }
    const activeCandidate = activeArticleId && filteredArticles.some(article => article.id === activeArticleId)
      ? activeArticleId
      : null;
    const nextId = activeCandidate ?? filteredArticles[0].id;
    if (nextId !== selectedArticleId) {
      setSelectedArticleId(nextId);
    }
  }, [activeArticleId, filteredArticles, selectedArticleId]);

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

    applyCachedPathData(selectedArticleId);
    if (!hasPathCache(selectedArticleId)) {
      refreshPathData(selectedArticleId, true);
    }
  }, [selectedArticleId]);

  // 由上面的“统一选择逻辑”负责同步 selectedArticleId

  useEffect(() => {
    if (!isActive) return;
    loadHomeData();
    if (selectedArticleId) {
      applyCachedPathData(selectedArticleId);
      if (!hasPathCache(selectedArticleId)) {
        refreshPathData(selectedArticleId, true);
      }
    }
  }, [isActive]);

  useEffect(() => {
    const handleCardsUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ articleId?: string }>).detail;
      if (!detail?.articleId) return;
      if (detail.articleId === selectedArticleId) {
        applyCachedPathData(detail.articleId);
      }
    };
    window.addEventListener('cards:update', handleCardsUpdate);
    return () => window.removeEventListener('cards:update', handleCardsUpdate);
  }, [selectedArticleId]);

  useEffect(() => {
    const handleProgressUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ articleId?: string; progress?: LearningProgress | null }>).detail;
      if (!detail?.articleId) return;
      if (detail.articleId === selectedArticleId) {
        setProgress(detail.progress ?? null);
      }
    };
    window.addEventListener('progress:update', handleProgressUpdate);
    return () => window.removeEventListener('progress:update', handleProgressUpdate);
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

  const hasPathCache = (articleId: string) => (
    getCardsCacheSnapshot(articleId) !== undefined
    && getQuizCacheSnapshot(articleId) !== undefined
    && getProgressCacheSnapshot(articleId) !== undefined
    && getRewardsCacheSnapshot(articleId) !== undefined
  );

  const applyCachedPathData = (articleId: string) => {
    const cachedCards = getCardsCacheSnapshot(articleId);
    if (cachedCards !== undefined) {
      setCards(cachedCards);
    }
    const cachedQuizzes = getQuizCacheSnapshot(articleId);
    if (cachedQuizzes !== undefined) {
      setQuizzes(cachedQuizzes);
    }
    const cachedProgress = getProgressCacheSnapshot(articleId);
    if (cachedProgress !== undefined) {
      setProgress(cachedProgress);
    }
    const cachedRewards = getRewardsCacheSnapshot(articleId);
    if (cachedRewards !== undefined) {
      setClaimedMilestones(cachedRewards.map((reward) => reward.milestone));
    }
  };

  const refreshPathData = async (articleId: string, showLoading = true) => {
    if (showLoading) {
      setIsPathLoading(true);
    }
    try {
      const [cardsData, quizData, progressData, rewardData] = await Promise.all([
        getCards(articleId),
        getQuizQuestions(articleId),
        getProgress(articleId),
        getRewards(articleId),
      ]);
      setCards(cardsData);
      setQuizzes(quizData);
      setProgress(progressData);
      setClaimedMilestones(rewardData.map((reward) => reward.milestone));
    } catch (error) {
      console.error('Failed to load path data:', error);
    } finally {
      if (showLoading) {
        setIsPathLoading(false);
      }
    }
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
      <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 pt-6">
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
                <p className="text-[11px] text-slate-400 mt-0.5">
                  标签：{selectedTagId
                    ? (selectedTagId === UNCATEGORIZED_TAG_ID ? '未分类' : (tagsById.get(selectedTagId)?.name || '未知'))
                    : '全部'}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>
            {showDropdown && (
              <div className="absolute mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-lg z-20 overflow-hidden">
                {filteredArticles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => handleSelectArticle(article.id)}
                    className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {article.title}
                  </button>
                ))}
                {filteredArticles.length === 0 && (
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

        <section className="mt-6 bg-white border border-slate-100 rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">标签筛选</h3>
              <p className="text-xs text-slate-400 mt-1">支持层级标签，未打标签的文章统一在“未分类”下</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setSelectedTagId(null)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                selectedTagId === null
                  ? 'bg-primary text-white border-primary'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              全部 ({articles.length})
            </button>
            <button
              onClick={() => setSelectedTagId(UNCATEGORIZED_TAG_ID)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                selectedTagId === UNCATEGORIZED_TAG_ID
                  ? 'bg-primary text-white border-primary'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              未分类 ({uncategorizedCount})
            </button>
            {(childrenByParent.get(null) || []).map((tag) => (
              <button
                key={tag.id}
                onClick={() => setSelectedTagId(tag.id)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  selectedTagId === tag.id
                    ? 'bg-primary text-white border-primary'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tag.name} ({tagCounts.get(tag.id) || 0})
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">标签目录</p>
            <div className="mt-2 max-h-64 overflow-auto space-y-1">
              <button
                onClick={() => setSelectedTagId(UNCATEGORIZED_TAG_ID)}
                className={`w-full text-left text-sm px-2 py-1 rounded-lg transition-colors ${
                  selectedTagId === UNCATEGORIZED_TAG_ID
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                未分类 ({uncategorizedCount})
              </button>
              {(childrenByParent.get(null) || []).map((tag) => {
                const renderNode = (node: Tag, depth: number): JSX.Element => {
                  const isActive = selectedTagId === node.id;
                  return (
                    <div key={node.id}>
                      <button
                        onClick={() => setSelectedTagId(node.id)}
                        className={`w-full text-left text-sm px-2 py-1 rounded-lg transition-colors ${
                          isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                        style={{ paddingLeft: 8 + depth * 12 }}
                      >
                        {node.name} ({tagCounts.get(node.id) || 0})
                      </button>
                      {(childrenByParent.get(node.id) || []).map((child) => renderNode(child, depth + 1))}
                    </div>
                  );
                };
                return renderNode(tag, 0);
              })}
            </div>
          </div>
        </section>

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
        ) : filteredArticles.length === 0 ? (
          <div className="mt-10 bg-white border border-slate-100 rounded-3xl p-8 text-center">
            <p className="text-base font-semibold text-slate-700">该标签下暂无文章</p>
            <p className="text-sm text-slate-400 mt-2">可以切换标签，或新增文章后再试</p>
            <button
              onClick={onCreate}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-2xl shadow-[0_6px_0_0_#245aa3] active:translate-y-1"
            >
              <Plus className="w-4 h-4" />
              新增文章
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
                <p className="text-sm text-slate-400 mt-2">进入文章详情页生成卡片</p>
                <button
                  onClick={() => selectedArticleId && onSelectArticle(selectedArticleId)}
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
