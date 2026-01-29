import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, FileText, HelpCircle, Layers, MessageCircle, Tv, X } from 'lucide-react';
import {
  createCards,
  createDialogueMessages,
  createGalgameMessages,
  createQuizQuestions,
  getArticle,
  getCards,
  getDialogueMessages,
  getGalgameMessages,
  getProgress,
  getQuizQuestions,
  getArticlesCacheSnapshot,
} from '../services/dataService';
import { AIResponseParseError, convertToDialogue, convertToGalgame, generateQuizQuestions, isConfigured, splitArticle } from '../services/openai';
import type { Article, LearningProgress } from '../types';

type Mode = 'original' | 'card' | 'dialogue' | 'galgame' | 'quiz';

type CharacterModalState = {
  isOpen: boolean;
  mode: 'dialogue' | 'galgame' | null;
};

interface ArticleHubProps {
  articleId: string;
  onBack: () => void;
  onOpenMode: (mode: Mode) => void;
}

export function ArticleHub({ articleId, onBack, onOpenMode }: ArticleHubProps) {
  const cachedArticles = getArticlesCacheSnapshot();
  const cachedArticle = cachedArticles?.find((item) => item.id === articleId) || null;
  const [article, setArticle] = useState<Article | null>(cachedArticle);
  const [cardCount, setCardCount] = useState(cachedArticle?.cardCount || 0);
  const [dialogueCount, setDialogueCount] = useState(cachedArticle?.messageCount || 0);
  const [galgameCount, setGalgameCount] = useState(cachedArticle?.galgameMessageCount || 0);
  const [quizCount, setQuizCount] = useState(cachedArticle?.quizCount || 0);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [isLoading, setIsLoading] = useState(!cachedArticle);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<Mode | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [characters, setCharacters] = useState('');
  const [characterModal, setCharacterModal] = useState<CharacterModalState>({ isOpen: false, mode: null });
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawAIResponse, setRawAIResponse] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const loadArticle = async () => {
    if (!cachedArticle) {
      setIsLoading(true);
    }
    try {
      const data = await getArticle(articleId);
      setArticle(data);
      await loadCounts();
    } catch (err) {
      console.error('Failed to load article:', err);
      setError('文章加载失败，请稍后重试');
    } finally {
      if (!cachedArticle) {
        setIsLoading(false);
      }
    }
  };

  const loadCounts = async () => {
    try {
      const [cards, dialogues, galgames, progressData, quizzes] = await Promise.all([
        getCards(articleId),
        getDialogueMessages(articleId),
        getGalgameMessages(articleId),
        getProgress(articleId),
        getQuizQuestions(articleId),
      ]);
      setCardCount(cards.length);
      setDialogueCount(dialogues.length);
      setGalgameCount(galgames.length);
      setProgress(progressData);
      setQuizCount(quizzes.length);
    } catch (err) {
      console.error('Failed to load mode counts:', err);
    }
  };

  useEffect(() => {
    loadArticle();
  }, [articleId]);

  useEffect(() => {
    if (!error) return;
    setShowErrorToast(true);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setShowErrorToast(false);
    }, 5000);

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [error]);

  const ensureConfigured = () => {
    if (!isConfigured()) {
      setError('请先在设置中配置 API Key');
      return false;
    }
    return true;
  };

  const progressPercent = cardCount > 0
    ? Math.min(100, Math.round((((progress?.current_index ?? -1) + 1) / cardCount) * 100))
    : 0;

  const handleGenerateCards = async () => {
    if (!article || !ensureConfigured()) return;
    setError('');
    setIsGenerating(true);
    setGeneratingMode('card');
    try {
      setProcessingStatus('AI 正在分析文章结构...');
      const cardResults = await splitArticle(article.original_content);
      setProcessingStatus('创建学习卡片...');
      await createCards(article.id, cardResults);
      await loadCounts();
      setProcessingStatus('完成!');
    } catch (err) {
      console.error('Failed to generate cards:', err);
      if (err instanceof AIResponseParseError) {
        setRawAIResponse(err.rawText);
        setShowRawModal(true);
      }
      setError(err instanceof Error ? err.message : '生成卡片失败，请重试');
    } finally {
      setIsGenerating(false);
      setGeneratingMode(null);
    }
  };

  const handleGenerateDialogue = async (mode: 'dialogue' | 'galgame') => {
    if (!article || !ensureConfigured()) return;
    if (!characters.trim()) {
      setError('请输入角色设定');
      return;
    }
    setError('');
    setIsGenerating(true);
    setGeneratingMode(mode);
    try {
      if (mode === 'dialogue') {
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
      await loadCounts();
      setProcessingStatus('完成!');
      setCharacters('');
      setCharacterModal({ isOpen: false, mode: null });
    } catch (err) {
      console.error('Failed to generate mode:', err);
      if (err instanceof AIResponseParseError) {
        setRawAIResponse(err.rawText);
        setShowRawModal(true);
      }
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
      setGeneratingMode(null);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!article || !ensureConfigured()) return;
    setError('');
    setIsGenerating(true);
    setGeneratingMode('quiz');
    try {
      setProcessingStatus('AI 正在生成单选题...');
      const results = await generateQuizQuestions(article.original_content);
      if (results.length === 0) {
        throw new Error('未生成题目，请重试');
      }
      setProcessingStatus('创建问答题目...');
      await createQuizQuestions(article.id, results);
      await loadCounts();
      setProcessingStatus('完成!');
    } catch (err) {
      console.error('Failed to generate quiz:', err);
      if (err instanceof AIResponseParseError) {
        setRawAIResponse(err.rawText);
        setShowRawModal(true);
      }
      setError(err instanceof Error ? err.message : '生成题目失败，请重试');
    } finally {
      setIsGenerating(false);
      setGeneratingMode(null);
    }
  };

  const openCharacterModal = (mode: 'dialogue' | 'galgame') => {
    setError('');
    setCharacters('');
    setCharacterModal({ isOpen: true, mode });
  };

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

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">文章不存在</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white/90 backdrop-blur border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 truncate">{article.title}</h1>
            <p className="text-xs text-slate-500">导入时间：{new Date(article.created_at).toLocaleDateString()}</p>
          </div>
          <button
            onClick={() => onOpenMode('original')}
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            查看原文
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {isGenerating && (
          <div className="p-4 bg-primary/10 text-primary rounded-2xl text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {processingStatus || '处理中...'}
          </div>
        )}

        <section className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400">学习进度</p>
              <p className="text-lg font-semibold text-slate-800 mt-1">
                {progress?.current_index !== undefined ? progress.current_index + 1 : 0} / {cardCount}
              </p>
            </div>
            <span className="text-sm font-semibold text-primary">{progressPercent}%</span>
          </div>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-4 flex gap-3">
            {cardCount > 0 ? (
              <button
                onClick={() => onOpenMode('card')}
                className="flex-1 py-3 bg-primary text-white rounded-2xl font-semibold shadow-[0_4px_0_0_#46a302] active:translate-y-1"
              >
                继续学习
              </button>
            ) : (
              <button
                onClick={handleGenerateCards}
                disabled={isGenerating}
                className="flex-1 py-3 bg-primary text-white rounded-2xl font-semibold shadow-[0_4px_0_0_#46a302] disabled:bg-slate-300"
              >
                生成卡片
              </button>
            )}
            <button
              onClick={() => onOpenMode('original')}
              className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-semibold"
            >
              阅读原文
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">模式入口</h2>
            <span className="text-xs text-slate-400">点击进入或生成</span>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 touch-pan-x">
            <button
              onClick={() => onOpenMode('original')}
              className="flex-shrink-0 w-44 bg-white rounded-2xl border border-slate-100 p-4 text-left shadow-sm"
            >
              <FileText className="w-6 h-6 text-amber-500" />
              <p className="mt-3 text-sm font-semibold text-slate-800">原文阅读</p>
              <p className="text-xs text-slate-400 mt-1">随时查看原文</p>
              <span className="mt-3 inline-flex text-xs font-semibold text-amber-600">打开</span>
            </button>

            <button
              onClick={() => (quizCount > 0 ? onOpenMode('quiz') : handleGenerateQuiz())}
              disabled={isGenerating && quizCount === 0}
              className="flex-shrink-0 w-44 bg-white rounded-2xl border border-slate-100 p-4 text-left shadow-sm"
            >
              <HelpCircle className="w-6 h-6 text-violet-600" />
              <p className="mt-3 text-sm font-semibold text-slate-800">问答模式</p>
              <p className="text-xs text-slate-400 mt-1">{quizCount > 0 ? `${quizCount} 道题目` : '未生成'}</p>
              <span className="mt-3 inline-flex text-xs font-semibold text-violet-600">
                {quizCount > 0 ? '进入' : '生成'}
              </span>
            </button>

            <button
              onClick={() => (cardCount > 0 ? onOpenMode('card') : handleGenerateCards())}
              disabled={isGenerating && cardCount === 0}
              className="flex-shrink-0 w-44 bg-white rounded-2xl border border-slate-100 p-4 text-left shadow-sm"
            >
              <Layers className="w-6 h-6 text-primary" />
              <p className="mt-3 text-sm font-semibold text-slate-800">卡片模式</p>
              <p className="text-xs text-slate-400 mt-1">{cardCount > 0 ? `${cardCount} 张卡片` : '未生成'}</p>
              <span className="mt-3 inline-flex text-xs font-semibold text-primary">
                {cardCount > 0 ? '进入' : '生成'}
              </span>
            </button>

            <button
              onClick={() => (dialogueCount > 0 ? onOpenMode('dialogue') : openCharacterModal('dialogue'))}
              disabled={isGenerating && dialogueCount === 0}
              className="flex-shrink-0 w-44 bg-white rounded-2xl border border-slate-100 p-4 text-left shadow-sm"
            >
              <MessageCircle className="w-6 h-6 text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-800">群聊模式</p>
              <p className="text-xs text-slate-400 mt-1">{dialogueCount > 0 ? `${dialogueCount} 条对话` : '未生成'}</p>
              <span className="mt-3 inline-flex text-xs font-semibold text-emerald-600">
                {dialogueCount > 0 ? '进入' : '生成'}
              </span>
            </button>

            <button
              onClick={() => (galgameCount > 0 ? onOpenMode('galgame') : openCharacterModal('galgame'))}
              disabled={isGenerating && galgameCount === 0}
              className="flex-shrink-0 w-44 bg-white rounded-2xl border border-slate-100 p-4 text-left shadow-sm"
            >
              <Tv className="w-6 h-6 text-cyan-600" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Galgame</p>
              <p className="text-xs text-slate-400 mt-1">{galgameCount > 0 ? `${galgameCount} 句台词` : '未生成'}</p>
              <span className="mt-3 inline-flex text-xs font-semibold text-cyan-600">
                {galgameCount > 0 ? '进入' : '生成'}
              </span>
            </button>
          </div>
        </section>
      </main>

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

      {showRawModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI 原始输出</h3>
                <p className="text-xs text-gray-500">生成失败时可复制这段内容手动修正</p>
              </div>
              <button
                onClick={() => setShowRawModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={rawAIResponse}
                readOnly
                rows={12}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rawAIResponse).catch(() => {});
                  }}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                >
                  复制内容
                </button>
                <button
                  onClick={() => setShowRawModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showErrorToast && error && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] w-full px-4">
          <div className="mx-auto max-w-2xl bg-red-600 text-white rounded-xl shadow-lg px-4 py-3 flex items-start gap-3">
            <span className="text-sm leading-relaxed break-words">{error}</span>
            <button
              onClick={() => setShowErrorToast(false)}
              className="ml-auto p-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label="关闭错误提示"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
