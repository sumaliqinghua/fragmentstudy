import { useEffect, useState } from 'react';
import { ChevronLeft, FileText, HelpCircle, Layers, MessageCircle, Sparkles, Tv, Users, X } from 'lucide-react';
import {
  createCards,
  createDialogueMessages,
  createGalgameMessages,
  createQuizQuestions,
  getArticle,
  getCards,
  getDialogueMessages,
  getGalgameMessages,
  getQuizQuestions,
} from '../services/dataService';
import { convertToDialogue, convertToGalgame, generateQuizQuestions, isConfigured, splitArticle } from '../services/openai';
import { OriginalTextView } from '../components/OriginalTextView';
import type { Article } from '../types';

type Mode = 'card' | 'dialogue' | 'galgame' | 'quiz';

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
  const [article, setArticle] = useState<Article | null>(null);
  const [cardCount, setCardCount] = useState(0);
  const [dialogueCount, setDialogueCount] = useState(0);
  const [galgameCount, setGalgameCount] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<Mode | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [characters, setCharacters] = useState('');
  const [characterModal, setCharacterModal] = useState<CharacterModalState>({ isOpen: false, mode: null });

  const loadArticle = async () => {
    setIsLoading(true);
    try {
      const data = await getArticle(articleId);
      setArticle(data);
      await loadCounts();
    } catch (err) {
      console.error('Failed to load article:', err);
      setError('文章加载失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCounts = async () => {
    try {
      const [cards, dialogues, galgames] = await Promise.all([
        getCards(articleId),
        getDialogueMessages(articleId),
        getGalgameMessages(articleId),
      ]);
      setCardCount(cards.length);
      setDialogueCount(dialogues.length);
      setGalgameCount(galgames.length);
      const quizzes = await getQuizQuestions(articleId);
      setQuizCount(quizzes.length);
    } catch (err) {
      console.error('Failed to load mode counts:', err);
    }
  };

  useEffect(() => {
    loadArticle();
  }, [articleId]);

  const ensureConfigured = () => {
    if (!isConfigured()) {
      setError('请先在设置中配置 API Key');
      return false;
    }
    return true;
  };

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{article.title}</h1>
            <p className="text-xs text-gray-500">导入时间：{new Date(article.created_at).toLocaleDateString()}</p>
          </div>
          <button
            onClick={() => setShowOriginal(true)}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            查看原文
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {isGenerating && (
          <div className="p-4 bg-teal-50 text-teal-700 rounded-xl text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            {processingStatus || '处理中...'}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">原文入口</h2>
              <p className="text-xs text-gray-500">随时查看原文并进行标注</p>
            </div>
          </div>
          <button
            onClick={() => setShowOriginal(true)}
            className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
          >
            打开原文
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">问答模式</h2>
              <p className="text-xs text-gray-500">{quizCount > 0 ? `已生成 ${quizCount} 道题目` : '未生成问答题'}</p>
            </div>
          </div>
          {quizCount > 0 ? (
            <button
              onClick={() => onOpenMode('quiz')}
              className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors"
            >
              开始答题
            </button>
          ) : (
            <button
              onClick={handleGenerateQuiz}
              disabled={isGenerating}
              className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors disabled:bg-gray-300"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                生成单选题
              </span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">卡片模式</h2>
              <p className="text-xs text-gray-500">{cardCount > 0 ? `已生成 ${cardCount} 张卡片` : '未生成卡片'}</p>
            </div>
          </div>
          {cardCount > 0 ? (
            <button
              onClick={() => onOpenMode('card')}
              className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
            >
              进入卡片学习
            </button>
          ) : (
            <button
              onClick={handleGenerateCards}
              disabled={isGenerating}
              className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors disabled:bg-gray-300"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                生成卡片
              </span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">群聊模式</h2>
              <p className="text-xs text-gray-500">{dialogueCount > 0 ? `已生成 ${dialogueCount} 条对话` : '未生成群聊'}</p>
            </div>
          </div>
          {dialogueCount > 0 ? (
            <button
              onClick={() => onOpenMode('dialogue')}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
            >
              进入群聊学习
            </button>
          ) : (
            <button
              onClick={() => openCharacterModal('dialogue')}
              disabled={isGenerating}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:bg-gray-300"
            >
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4" />
                生成群聊
              </span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Tv className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">视觉小说模式</h2>
              <p className="text-xs text-gray-500">{galgameCount > 0 ? `已生成 ${galgameCount} 句台词` : '未生成视觉小说'}</p>
            </div>
          </div>
          {galgameCount > 0 ? (
            <button
              onClick={() => onOpenMode('galgame')}
              className="w-full py-2.5 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors"
            >
              进入视觉小说
            </button>
          ) : (
            <button
              onClick={() => openCharacterModal('galgame')}
              disabled={isGenerating}
              className="w-full py-2.5 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 transition-colors disabled:bg-gray-300"
            >
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4" />
                生成视觉小说
              </span>
            </button>
          )}
        </div>
      </main>

      <OriginalTextView
        isOpen={showOriginal}
        articleId={article.id}
        originalContent={article.original_content}
        onClose={() => setShowOriginal(false)}
      />

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
    </div>
  );
}
