import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Keyboard } from 'lucide-react';
import {
  getArticle,
  getCards,
  getProgress,
  upsertProgress,
  getRewards,
  claimReward,
  getBookmarks,
  toggleBookmark,
  getConversationCount,
  getAllHighlights,
} from '../services/dataService';
import { CardStack } from '../components/CardStack';
import { ProgressBar } from '../components/ProgressBar';
import { TreasureBox } from '../components/TreasureBox';
import { ContextPreview } from '../components/ContextPreview';
import { OriginalTextView } from '../components/OriginalTextView';
import { AIChat } from '../components/AIChat';
import type { Article, Card, Highlight } from '../types';

interface CardReaderProps {
  articleId: string;
  onBack: () => void;
}

const MILESTONES = [30, 60, 80] as const;

export function CardReader({ articleId, onBack }: CardReaderProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [claimedMilestones, setClaimedMilestones] = useState<number[]>([]);
  const [bookmarkedCards, setBookmarkedCards] = useState<Set<string>>(new Set());
  const [conversationCount, setConversationCount] = useState(0);
  const [highlightsMap, setHighlightsMap] = useState<Map<string, Highlight[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const [showContextPreview, setShowContextPreview] = useState(false);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [pendingMilestone, setPendingMilestone] = useState<30 | 60 | 80 | null>(null);

  useEffect(() => {
    loadData();
  }, [articleId]);

  const loadData = async () => {
    try {
      const [articleData, cardsData, progressData, rewardsData, bookmarksData, convCount, highlights] = await Promise.all([
        getArticle(articleId),
        getCards(articleId),
        getProgress(articleId),
        getRewards(articleId),
        getBookmarks(articleId),
        getConversationCount(articleId),
        getAllHighlights(articleId),
      ]);

      setArticle(articleData);
      setCards(cardsData);
      setCurrentIndex(progressData?.current_index || 0);
      setClaimedMilestones(rewardsData.map(r => r.milestone));
      setBookmarkedCards(new Set(bookmarksData));
      setConversationCount(convCount);
      setHighlightsMap(highlights);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshConversationCount = async () => {
    try {
      const count = await getConversationCount(articleId);
      setConversationCount(count);
    } catch (error) {
      console.error('Failed to refresh conversation count:', error);
    }
  };

  const checkMilestone = useCallback((index: number) => {
    if (cards.length === 0) return;

    const percent = Math.round(((index + 1) / cards.length) * 100);

    for (const milestone of MILESTONES) {
      if (percent >= milestone && !claimedMilestones.includes(milestone)) {
        setPendingMilestone(milestone);
        break;
      }
    }
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
      checkMilestone(newIndex);
    }
  }, [currentIndex, cards.length, saveProgress, checkMilestone]);

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
      if (showContextPreview || showOriginalText || showAIChat || pendingMilestone) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, showContextPreview, showOriginalText, showAIChat, pendingMilestone]);

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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      <header className="shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 truncate flex-1">
              {article.title}
            </h1>
          </div>

          <ProgressBar
            current={currentIndex}
            total={cards.length}
            claimedMilestones={claimedMilestones}
          />
        </div>
      </header>

      <CardStack
        cards={cards}
        currentIndex={currentIndex}
        isBookmarked={bookmarkedCards.has(currentCard?.id || '')}
        conversationCount={conversationCount}
        highlights={currentHighlights}
        onNext={handleNext}
        onPrev={handlePrev}
        onLongPress={() => setShowContextPreview(true)}
        onViewOriginal={() => setShowOriginalText(true)}
        onToggleBookmark={handleToggleBookmark}
        onAskAI={() => setShowAIChat(true)}
        onHighlightAdded={handleHighlightAdded}
      />

      <footer className="shrink-0 pb-4 pt-1 px-4">
        <div className="max-w-md mx-auto flex items-center justify-center gap-1 text-xs text-gray-400">
          <Keyboard className="w-3.5 h-3.5" />
          <span>方向键切换卡片</span>
        </div>
      </footer>

      <ContextPreview
        isOpen={showContextPreview}
        currentCard={currentCard}
        prevCard={cards[currentIndex - 1] || null}
        nextCard={cards[currentIndex + 1] || null}
        onClose={() => setShowContextPreview(false)}
      />

      <OriginalTextView
        isOpen={showOriginalText}
        articleId={articleId}
        originalContent={article.original_content}
        currentCard={currentCard}
        allCards={cards}
        onClose={() => setShowOriginalText(false)}
        onJumpToCard={(index) => {
          setCurrentIndex(index);
          setShowOriginalText(false);
        }}
      />

      <AIChat
        isOpen={showAIChat}
        currentCard={currentCard}
        previousCards={previousCards}
        onClose={() => setShowAIChat(false)}
        onConversationSaved={refreshConversationCount}
      />

      <TreasureBox
        isOpen={pendingMilestone !== null}
        milestone={pendingMilestone || 30}
        onClaim={handleClaimReward}
        onClose={() => setPendingMilestone(null)}
      />
    </div>
  );
}
