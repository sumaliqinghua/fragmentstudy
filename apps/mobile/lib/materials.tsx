import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './auth';
import * as dataService from './dataService';
import { ensureSampleMaterial } from './sample';
import { addXp, loadStats, recordStopComplete } from './stats';
import type { ArticleWithProgress, Card, LearningProgress } from './types';

interface MaterialsContextType {
  articles: ArticleWithProgress[];
  activeArticleId: string | null;
  cards: Card[];
  progress: LearningProgress | null;
  streak: number;
  xp: number;
  isReady: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setActiveArticleId: (id: string) => void;
  saveCardProgress: (cardIndex: number) => Promise<void>;
  completeStop: () => Promise<void>;
  bumpXp: (amount: number) => Promise<void>;
}

const MaterialsContext = createContext<MaterialsContextType | undefined>(undefined);

export function MaterialsProvider({ children }: { children: ReactNode }) {
  const { isGuest, isLoading: authLoading } = useAuth();
  const [articles, setArticles] = useState<ArticleWithProgress[]>([]);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      if (isGuest) {
        await ensureSampleMaterial();
      }
      const list = await dataService.getArticles();
      setArticles(list);

      setActiveArticleId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev;
        return list[0]?.id ?? null;
      });

      const stats = await loadStats();
      setStreak(stats.streak);
      setXp(stats.xp);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setIsReady(true);
    }
  }, [isGuest]);

  useEffect(() => {
    if (authLoading) return;
    setIsReady(false);
    void refresh();
    // Re-seed when auth identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isGuest]);

  useEffect(() => {
    if (!activeArticleId || !isReady) return;
    let cancelled = false;
    (async () => {
      try {
        const [nextCards, nextProgress] = await Promise.all([
          dataService.getCards(activeArticleId),
          dataService.getProgress(activeArticleId, 'card'),
        ]);
        if (!cancelled) {
          setCards(nextCards);
          setProgress(nextProgress);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载资料失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeArticleId, isReady]);

  const saveCardProgress = useCallback(
    async (cardIndex: number) => {
      if (!activeArticleId || cards.length === 0) return;
      const next = await dataService.upsertProgress(
        activeArticleId,
        cardIndex,
        cards.length,
        'card'
      );
      setProgress(next);
      setArticles((prev) =>
        prev.map((a) => (a.id === activeArticleId ? { ...a, progress: next } : a))
      );
    },
    [activeArticleId, cards.length]
  );

  const bumpXp = useCallback(async (amount: number) => {
    const next = await addXp(amount);
    setXp(next);
  }, []);

  const completeStop = useCallback(async () => {
    const result = await recordStopComplete();
    setStreak(result.streak);
    setXp(result.xp);
  }, []);

  const value = useMemo(
    () => ({
      articles,
      activeArticleId,
      cards,
      progress,
      streak,
      xp,
      isReady,
      error,
      refresh,
      setActiveArticleId,
      saveCardProgress,
      completeStop,
      bumpXp,
    }),
    [
      articles,
      activeArticleId,
      cards,
      progress,
      streak,
      xp,
      isReady,
      error,
      refresh,
      saveCardProgress,
      completeStop,
      bumpXp,
    ]
  );

  return <MaterialsContext.Provider value={value}>{children}</MaterialsContext.Provider>;
}

export function useMaterials() {
  const ctx = useContext(MaterialsContext);
  if (!ctx) throw new Error('useMaterials must be used within MaterialsProvider');
  return ctx;
}
