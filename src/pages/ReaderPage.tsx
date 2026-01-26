import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { getArticle, getCards, getDialogueMessages, getGalgameMessages, getProgress } from '../services/dataService';
import { SegmentControl } from '../components/SegmentControl';
import { OriginalReader } from '../components/OriginalReader';
import { DialogueReader } from '../components/DialogueReader';
import { GalgameReader } from '../components/GalgameReader';
import type { Article, Card, LearningProgress } from '../types';

export type ReaderMode = 'original' | 'dialogue' | 'galgame';

interface ReaderPageProps {
  articleId: string;
  initialMode?: ReaderMode;
  onBack: () => void;
  onOpenHub?: () => void;
  onStartQuiz?: () => void;
}

export function ReaderPage({ articleId, initialMode = 'original', onBack, onOpenHub, onStartQuiz }: ReaderPageProps) {
  const [mode, setMode] = useState<ReaderMode>(initialMode);
  const [article, setArticle] = useState<Article | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [dialogueCount, setDialogueCount] = useState(0);
  const [galgameCount, setGalgameCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [articleData, cardsData, progressData, dialogueData, galgameData] = await Promise.all([
          getArticle(articleId),
          getCards(articleId),
          getProgress(articleId),
          getDialogueMessages(articleId),
          getGalgameMessages(articleId),
        ]);
        setArticle(articleData);
        setCards(cardsData);
        setProgress(progressData);
        setDialogueCount(dialogueData.length);
        setGalgameCount(galgameData.length);
      } catch (error) {
        console.error('Failed to load reader data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [articleId]);

  const progressPercent = useMemo(() => {
    if (!progress || cards.length === 0) return 0;
    return Math.min(100, Math.round(((progress.current_index + 1) / cards.length) * 100));
  }, [cards.length, progress]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">文章不存在</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div className="h-full bg-primary rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <button
            onClick={() => undefined}
            className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center"
          >
            <Settings2 className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        <div className="max-w-md mx-auto px-4 pb-3">
          <SegmentControl
            tabs={[
              { key: 'original', label: '原文' },
              { key: 'dialogue', label: '群聊' },
              { key: 'galgame', label: 'Galgame' },
            ]}
            activeKey={mode}
            onChange={(key) => setMode(key as ReaderMode)}
          />
        </div>
      </header>

      {mode === 'original' && (
        <OriginalReader
          article={article}
          onStartQuiz={onStartQuiz}
        />
      )}

      {mode === 'dialogue' && (
        <div className="max-w-md mx-auto">
          {dialogueCount === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold text-slate-700">群聊内容未生成</p>
              <p className="text-sm text-slate-400 mt-2">先在文章详情里生成对话内容</p>
              <button
                onClick={onOpenHub}
                className="mt-5 px-4 py-2 bg-secondary text-white rounded-2xl shadow-[0_4px_0_0_#245aa3] active:translate-y-1"
              >
                去生成
              </button>
            </div>
          ) : (
            <div className="min-h-[60vh]">
              <DialogueReader article={article} onBack={onBack} embedded />
            </div>
          )}
        </div>
      )}

      {mode === 'galgame' && (
        <div className="max-w-md mx-auto">
          {galgameCount === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold text-slate-700">Galgame 内容未生成</p>
              <p className="text-sm text-slate-400 mt-2">先在文章详情里生成剧情内容</p>
              <button
                onClick={onOpenHub}
                className="mt-5 px-4 py-2 bg-secondary text-white rounded-2xl shadow-[0_4px_0_0_#245aa3] active:translate-y-1"
              >
                去生成
              </button>
            </div>
          ) : (
            <div className="min-h-[70vh]">
              <GalgameReader article={article} onBack={onBack} embedded />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
