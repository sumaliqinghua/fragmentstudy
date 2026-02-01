import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Settings2, X } from 'lucide-react';
import {
  createDialogueMessages,
  createGalgameMessages,
  getArticle,
  getCards,
  getDialogueMessages,
  getGalgameMessages,
  getProgress,
} from '../services/dataService';
import { SegmentControl } from '../components/SegmentControl';
import { OriginalReader } from '../components/OriginalReader';
import { DialogueReader } from '../components/DialogueReader';
import { GalgameReader } from '../components/GalgameReader';
import type { Article, Card, LearningProgress } from '../types';
import { AIResponseParseError, convertToDialogue, convertToGalgame, isConfigured } from '../services/openai';

export type ReaderMode = 'original' | 'dialogue' | 'galgame';

interface ReaderPageProps {
  articleId: string;
  initialMode?: ReaderMode;
  onBack: () => void;
  onStartQuiz?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function ReaderPage({ articleId, initialMode = 'original', onBack, onStartQuiz, onFullscreenChange }: ReaderPageProps) {
  const [mode, setMode] = useState<ReaderMode>(initialMode);
  const [article, setArticle] = useState<Article | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [dialogueCount, setDialogueCount] = useState(0);
  const [galgameCount, setGalgameCount] = useState(0);
  const [isGalgameFullscreen, setIsGalgameFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [readingPercent, setReadingPercent] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<'dialogue' | 'galgame' | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [characters, setCharacters] = useState('');
  const [characterModal, setCharacterModal] = useState<{ isOpen: boolean; mode: 'dialogue' | 'galgame' | null }>({
    isOpen: false,
    mode: null,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (mode !== 'galgame' || galgameCount === 0) {
      setIsGalgameFullscreen(false);
    }
  }, [mode, galgameCount]);

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

  const loadDialogueCounts = async () => {
    try {
      const [dialogueData, galgameData] = await Promise.all([
        getDialogueMessages(articleId),
        getGalgameMessages(articleId),
      ]);
      setDialogueCount(dialogueData.length);
      setGalgameCount(galgameData.length);
    } catch (error) {
      console.error('Failed to load mode counts:', error);
    }
  };

  const ensureConfigured = () => {
    if (!isConfigured()) {
      setError('请先在设置中配置 API Key');
      return false;
    }
    return true;
  };

  const handleGenerateDialogue = async (targetMode: 'dialogue' | 'galgame') => {
    if (!article || !ensureConfigured()) return;
    if (!characters.trim()) {
      setError('请输入角色设定');
      return;
    }
    setError('');
    setIsGenerating(true);
    setGeneratingMode(targetMode);
    try {
      if (targetMode === 'dialogue') {
        setProcessingStatus('AI 正在生成群聊对话...');
        const results = await convertToDialogue(article.original_content, characters);
        setProcessingStatus('创建对话消息...');
        await createDialogueMessages(article.id, results);
      } else {
        setProcessingStatus('AI 正在生成视觉小说剧本...');
        const results = await convertToGalgame(article.original_content, characters);
        setProcessingStatus('创建视觉小说场景...');
        await createGalgameMessages(article.id, results);
      }
      await loadDialogueCounts();
      setProcessingStatus('完成!');
      setCharacters('');
      setCharacterModal({ isOpen: false, mode: null });
    } catch (err) {
      console.error('Failed to generate mode:', err);
      if (err instanceof AIResponseParseError) {
        setError('生成失败，请检查角色设定或稍后重试');
      } else {
        setError(err instanceof Error ? err.message : '生成失败，请重试');
      }
    } finally {
      setIsGenerating(false);
      setGeneratingMode(null);
    }
  };

  const progressPercent = useMemo(() => {
    if (!progress || cards.length === 0) return 0;
    return Math.min(100, Math.round(((progress.current_index + 1) / cards.length) * 100));
  }, [cards.length, progress]);
  const displayProgress = mode === 'original' ? readingPercent : progressPercent;

  const hideReaderChrome = mode === 'galgame' && galgameCount > 0 && isGalgameFullscreen;

  useEffect(() => {
    onFullscreenChange?.(hideReaderChrome);
  }, [hideReaderChrome, onFullscreenChange]);

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
    <div className={`min-h-screen bg-white ${hideReaderChrome ? '' : 'pb-24'}`}>
      {!hideReaderChrome && (
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-100">
          <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex-1">
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div className="h-full bg-primary rounded-full" style={{ width: `${displayProgress}%` }} />
              </div>
            </div>
            <button
              onClick={() => undefined}
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center"
            >
              <Settings2 className="w-5 h-5 text-slate-600" />
            </button>
          </div>
          <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto px-4 pb-3">
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
      )}

      {mode === 'original' && (
        <OriginalReader
          article={article}
          onStartQuiz={onStartQuiz}
          onScrollProgress={setReadingPercent}
        />
      )}

      {mode === 'dialogue' && (
        <div className="max-w-md md:max-w-3xl lg:max-w-5xl mx-auto">
          {dialogueCount === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold text-slate-700">群聊内容未生成</p>
              <p className="text-sm text-slate-400 mt-2">在这里直接生成群聊对话</p>
              <button
                onClick={() => {
                  setError('');
                  setCharacterModal({ isOpen: true, mode: 'dialogue' });
                }}
                className="mt-5 px-4 py-2 bg-secondary text-white rounded-2xl shadow-[0_4px_0_0_#245aa3] active:translate-y-1 disabled:opacity-60"
                disabled={isGenerating}
              >
                {isGenerating && generatingMode === 'dialogue' ? '生成中...' : '生成群聊'}
              </button>
              {processingStatus && generatingMode === 'dialogue' && (
                <p className="mt-3 text-xs text-slate-400">{processingStatus}</p>
              )}
            </div>
          ) : (
            <div className="min-h-[60vh]">
              <DialogueReader article={article} onBack={onBack} embedded />
            </div>
          )}
        </div>
      )}

      {mode === 'galgame' && (
        <div className={isGalgameFullscreen ? '' : 'max-w-md md:max-w-3xl lg:max-w-5xl mx-auto'}>
          {galgameCount === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold text-slate-700">Galgame 内容未生成</p>
              <p className="text-sm text-slate-400 mt-2">在这里直接生成剧情内容</p>
              <button
                onClick={() => {
                  setError('');
                  setCharacterModal({ isOpen: true, mode: 'galgame' });
                }}
                className="mt-5 px-4 py-2 bg-secondary text-white rounded-2xl shadow-[0_4px_0_0_#245aa3] active:translate-y-1 disabled:opacity-60"
                disabled={isGenerating}
              >
                {isGenerating && generatingMode === 'galgame' ? '生成中...' : '生成 Galgame'}
              </button>
              {processingStatus && generatingMode === 'galgame' && (
                <p className="mt-3 text-xs text-slate-400">{processingStatus}</p>
              )}
            </div>
          ) : (
            <GalgameReader article={article} onBack={onBack} onFullscreenChange={setIsGalgameFullscreen} />
          )}
        </div>
      )}

      {characterModal.isOpen && characterModal.mode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">角色设定</h3>
                <p className="text-xs text-gray-500">
                  {characterModal.mode === 'galgame' ? '建议 2-3 个角色' : '设置群聊角色'}
                </p>
              </div>
              <button
                onClick={() => setCharacterModal({ isOpen: false, mode: null })}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                disabled={isGenerating}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={characters}
                onChange={(e) => setCharacters(e.target.value)}
                placeholder={characterModal.mode === 'galgame'
                  ? '描述 2-3 个角色，例如：\n\n凛 - 主角，冷静睿智的老师，擅长用比喻解释复杂概念\n小樱 - 学生，活泼好奇，经常提出有趣的问题\n\n或者直接写：用 Fate 里的远坂凛和间桐樱'
                  : '描述你想要的角色，例如：\n\n悟空 - 讲解者，热情直爽，喜欢用战斗类比\n悟饭 - 学习者，好奇认真，爱问问题\n\n或者直接写：用七龙珠里的悟空和悟饭'}
                rows={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
              />
              <p className="text-xs text-gray-500">
                {characterModal.mode === 'galgame'
                  ? 'AI 会生成类似逆转裁判/Fate 风格的视觉小说对话，包含情绪表情和屏幕特效'
                  : 'AI 会根据你的描述生成群聊对话，用角色世界观来讲解知识'}
              </p>
              {error && (
                <div className="text-xs text-red-500">{error}</div>
              )}
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setCharacterModal({ isOpen: false, mode: null })}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={isGenerating}
              >
                取消
              </button>
              <button
                onClick={() => handleGenerateDialogue(characterModal.mode)}
                disabled={isGenerating || !characters.trim()}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors disabled:bg-gray-300"
              >
                {generatingMode === characterModal.mode ? '生成中...' : '开始生成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
