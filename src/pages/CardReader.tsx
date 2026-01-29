import { useState, useEffect, useCallback } from 'react';
import { MoreHorizontal, X, RotateCcw, Check } from 'lucide-react';
import {
  getArticle,
  getCards,
  getProgress,
  upsertProgress,
  getRewards,
  claimReward,
  getBookmarks,
  toggleBookmark,
  getAllHighlights,
} from '../services/dataService';
import { CardStack } from '../components/CardStack';
import { ProgressBar } from '../components/ProgressBar';
import { TreasureBox } from '../components/TreasureBox';
import { StreakModal } from '../components/StreakModal';
import { ContextPreview } from '../components/ContextPreview';
import { AIChat } from '../components/AIChat';
import { ActionMenu } from '../components/ActionMenu';
import { getStreakDays, recordStreak } from '../utils/streak';
import type { Article, Card, Highlight } from '../types';

interface CardReaderProps {
  articleId: string;
  onBack: () => void;
  onOpenOriginal: () => void;
}

const MILESTONES = [30, 60, 80] as const;

export function CardReader({ articleId, onBack, onOpenOriginal }: CardReaderProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [claimedMilestones, setClaimedMilestones] = useState<number[]>([]);
  const [bookmarkedCards, setBookmarkedCards] = useState<Set<string>>(new Set());
  const [highlightsMap, setHighlightsMap] = useState<Map<string, Highlight[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const [showContextPreview, setShowContextPreview] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [pendingMilestone, setPendingMilestone] = useState<30 | 60 | 80 | null>(null);
  const [showStreak, setShowStreak] = useState(false);
  const [streakDays, setStreakDays] = useState(() => getStreakDays());
  const [streakQueued, setStreakQueued] = useState(false);

  useEffect(() => {
    loadData();
  }, [articleId]);

  const loadData = async () => {
    try {
      const [articleData, cardsData, progressData, rewardsData, bookmarksData, highlights] = await Promise.all([
        getArticle(articleId),
        getCards(articleId),
        getProgress(articleId),
        getRewards(articleId),
        getBookmarks(articleId),
        getAllHighlights(articleId),
      ]);

      setArticle(articleData);
      setCards(cardsData);
      setCurrentIndex(progressData?.current_index || 0);
      setClaimedMilestones(rewardsData.map(r => r.milestone));
      setBookmarkedCards(new Set(bookmarksData));
      setHighlightsMap(highlights);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConversationSaved = () => {
    return;
  };

  const getMilestone = useCallback((index: number) => {
    if (cards.length === 0) return;

    const percent = Math.round(((index + 1) / cards.length) * 100);

    for (const milestone of MILESTONES) {
      if (percent >= milestone && !claimedMilestones.includes(milestone)) {
        return milestone;
      }
    }
    return null;
  }, [cards.length, claimedMilestones]);

  const saveProgress = useCallback(async (index: number) => {
    try {
      await upsertProgress(articleId, index, cards.length);
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, [articleId, cards.length]);

  const handleNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      saveProgress(newIndex);
      const milestone = getMilestone(newIndex);
      if (milestone) {
        setPendingMilestone(milestone);
        setStreakQueued(true);
      } else {
        const result = recordStreak();
        setStreakDays(result.streakDays);
        if (result.shouldShow) {
          setShowStreak(true);
        }
      }
    }
  }, [currentIndex, cards.length, saveProgress, getMilestone]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      saveProgress(newIndex);
    }
  }, [currentIndex, saveProgress]);

  const handleClaimReward = async () => {
    if (!pendingMilestone) return null;

    const reward = await claimReward(articleId, pendingMilestone);
    if (reward) {
      setClaimedMilestones(prev => [...prev, pendingMilestone]);
    }
    if (streakQueued) {
      const result = recordStreak({ forceShow: true });
      setStreakDays(result.streakDays);
      if (result.shouldShow) {
        setShowStreak(true);
      }
      setStreakQueued(false);
    }
    return reward?.points || null;
  };

  const handleToggleBookmark = async () => {
    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    const isNowBookmarked = await toggleBookmark(currentCard.id);
    setBookmarkedCards(prev => {
      const newSet = new Set(prev);
      if (isNowBookmarked) {
        newSet.add(currentCard.id);
      } else {
        newSet.delete(currentCard.id);
      }
      return newSet;
    });
  };

  const handleHighlightAdded = (highlight: Highlight) => {
    setHighlightsMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(highlight.card_id) || [];
      newMap.set(highlight.card_id, [...existing, highlight]);
      return newMap;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showContextPreview || showAIChat || pendingMilestone) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, showContextPreview, showAIChat, pendingMilestone]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!article || cards.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">文章不存在或没有卡片</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const previousCards = cards.slice(0, currentIndex);
  const currentHighlights = highlightsMap.get(currentCard?.id || '') || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="shrink-0 px-4 pt-6 pb-2">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center justify-center size-10 rounded-full hover:bg-slate-100 transition-colors text-slate-400"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex-1 mx-4">
              <ProgressBar
                current={currentIndex}
                total={cards.length}
                claimedMilestones={claimedMilestones}
              />
            </div>
            <button
              onClick={() => setShowActions(true)}
              className="flex items-center justify-center size-10 rounded-full hover:bg-slate-100 transition-colors text-slate-400"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
          <h1 className="mt-3 text-sm font-semibold text-slate-700 truncate text-center">
            {article.title}
          </h1>
        </div>
      </header>

      <CardStack
        cards={cards}
        currentIndex={currentIndex}
        highlights={currentHighlights}
        onNext={handleNext}
        onPrev={handlePrev}
        onLongPress={() => setShowContextPreview(true)}
        onHighlightAdded={handleHighlightAdded}
      />

      <footer className="shrink-0 pb-10 pt-4 px-6 flex justify-center items-center gap-6">
        <button
          aria-label="Skip"
          onClick={handleNext}
          className="flex items-center justify-center size-14 rounded-full bg-white border-2 border-slate-200 text-slate-300 shadow-sm hover:border-rose-400 hover:text-rose-500 transition-all"
        >
          <X className="w-6 h-6" />
        </button>
        <button
          aria-label="Previous"
          onClick={handlePrev}
          className="flex items-center justify-center size-11 rounded-full bg-transparent text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          aria-label="Mastered"
          onClick={handleNext}
          className="flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all"
        >
          <Check className="w-6 h-6" />
        </button>
      </footer>

      <ContextPreview
        isOpen={showContextPreview}
        currentCard={currentCard}
        prevCard={cards[currentIndex - 1] || null}
        nextCard={cards[currentIndex + 1] || null}
        onClose={() => setShowContextPreview(false)}
      />

      <AIChat
        isOpen={showAIChat}
        currentCard={currentCard}
        previousCards={previousCards}
        onClose={() => setShowAIChat(false)}
        onConversationSaved={handleConversationSaved}
      />

      <ActionMenu
        isOpen={showActions}
        isBookmarked={bookmarkedCards.has(currentCard?.id || '')}
        onClose={() => setShowActions(false)}
        onViewOriginal={() => {
          setShowActions(false);
          onOpenOriginal();
        }}
        onToggleBookmark={() => {
          setShowActions(false);
          handleToggleBookmark();
        }}
        onAskAI={() => {
          setShowActions(false);
          setShowAIChat(true);
        }}
      />

      <TreasureBox
        isOpen={pendingMilestone !== null}
        milestone={pendingMilestone || 30}
        onClaim={handleClaimReward}
        onClose={() => setPendingMilestone(null)}
      />

      <StreakModal
        isOpen={showStreak}
        streakDays={streakDays}
        onClose={() => setShowStreak(false)}
      />
    </div>
  );
}
