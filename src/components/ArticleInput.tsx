import { useState } from 'react';
import { X, Sparkles, FileText, Loader2, MessageCircle, Layers, ChevronRight, ChevronLeft, Users, Tv } from 'lucide-react';
import { splitArticle, convertToDialogue, convertToGalgame } from '../services/openai';
import { createArticle, createCards, createDialogueMessages, createGalgameMessages } from '../services/dataService';
import { isConfigured } from '../services/openai';
import type { ArticleMode } from '../types';

interface ArticleInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'content' | 'mode' | 'processing';

export function ArticleInput({ isOpen, onClose, onSuccess }: ArticleInputProps) {
  const [step, setStep] = useState<Step>('content');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<ArticleMode>('card');
  const [characters, setCharacters] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState('');

  const resetForm = () => {
    setStep('content');
    setTitle('');
    setContent('');
    setMode('card');
    setCharacters('');
    setIsProcessing(false);
    setProcessingStatus('');
    setError('');
  };

  const handleNextStep = () => {
    if (!title.trim() || !content.trim()) {
      setError('请填写标题和内容');
      return;
    }
    if (!isConfigured()) {
      setError('请先在设置中配置 API Key');
      return;
    }
    setError('');
    setStep('mode');
  };

  const handleSubmit = async () => {
    if ((mode === 'dialogue' || mode === 'galgame') && !characters.trim()) {
      setError('请输入角色设定');
      return;
    }

    setStep('processing');
    setIsProcessing(true);
    setError('');

    try {
      if (mode === 'card') {
        setProcessingStatus('AI 正在分析文章结构...');
        const cardResults = await splitArticle(content);

        setProcessingStatus('保存文章...');
        const article = await createArticle(title, content, 'card');

        setProcessingStatus('创建学习卡片...');
        await createCards(article.id, cardResults);
      } else if (mode === 'dialogue') {
        setProcessingStatus('AI 正在生成角色对话...');
        const dialogueResults = await convertToDialogue(content, characters);

        setProcessingStatus('保存文章...');
        const article = await createArticle(title, content, 'dialogue', characters);

        setProcessingStatus('创建对话消息...');
        await createDialogueMessages(article.id, dialogueResults);
      } else if (mode === 'galgame') {
        setProcessingStatus('AI 正在生成视觉小说剧本...');
        const galgameResults = await convertToGalgame(content, characters);

        setProcessingStatus('保存文章...');
        const article = await createArticle(title, content, 'galgame', characters);

        setProcessingStatus('创建视觉小说场景...');
        await createGalgameMessages(article.id, galgameResults);
      }

      setProcessingStatus('完成!');
      setTimeout(() => {
        resetForm();
        onSuccess();
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败，请重试');
      setIsProcessing(false);
      setStep('mode');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">导入文章</h2>
              <p className="text-xs text-gray-500">
                {step === 'content' && '第 1 步：填写内容'}
                {step === 'mode' && '第 2 步：选择学习模式'}
                {step === 'processing' && '处理中...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); onClose(); }}
            disabled={isProcessing}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {step === 'content' && (
          <>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文章标题
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入文章标题..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文章内容
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="粘贴你想要学习的文章..."
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 shrink-0">
              <button
                onClick={handleNextStep}
                disabled={!title.trim() || !content.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-teal-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all"
              >
                下一步
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {step === 'mode' && (
          <>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setMode('card')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === 'card'
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                    mode === 'card' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">卡片模式</h3>
                  <p className="text-xs text-gray-500">
                    知识卡片逐张学习
                  </p>
                </button>

                <button
                  onClick={() => setMode('dialogue')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === 'dialogue'
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                    mode === 'dialogue' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">对话模式</h3>
                  <p className="text-xs text-gray-500">
                    角色对话聊天风格
                  </p>
                </button>

                <button
                  onClick={() => setMode('galgame')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    mode === 'galgame'
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                    mode === 'galgame' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Tv className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">视觉小说</h3>
                  <p className="text-xs text-gray-500">
                    Gal Game 沉浸体验
                  </p>
                </button>
              </div>

              {(mode === 'dialogue' || mode === 'galgame') && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Users className="w-4 h-4" />
                    角色设定 {mode === 'galgame' && <span className="text-xs text-gray-400">(建议 2-3 个角色)</span>}
                  </div>
                  <textarea
                    value={characters}
                    onChange={(e) => setCharacters(e.target.value)}
                    placeholder={mode === 'galgame'
                      ? "描述 2-3 个角色，例如：\n\n凛 - 主角，冷静睿智的老师，擅长用比喻解释复杂概念\n小樱 - 学生，活泼好奇，经常提出有趣的问题\n\n或者直接写：用 Fate 里的远坂凛和间桐樱"
                      : "描述你想要的角色，例如：\n\n悟空 - 讲解者，热情直爽，喜欢用战斗类比\n悟饭 - 学习者，好奇认真，爱问问题\n\n或者直接写：用七龙珠里的悟空和悟饭"}
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    {mode === 'galgame'
                      ? 'AI 会生成类似逆转裁判/Fate 风格的视觉小说对话，包含情绪表情和屏幕特效'
                      : 'AI 会根据你的描述生成角色对话，用他们的世界观来讲解知识'}
                  </p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 shrink-0 flex gap-3">
              <button
                onClick={() => { setStep('content'); setError(''); }}
                className="px-5 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
                上一步
              </button>
              <button
                onClick={handleSubmit}
                disabled={(mode === 'dialogue' || mode === 'galgame') && !characters.trim()}
                className="flex-1 py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-teal-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all"
              >
                <Sparkles className="w-5 h-5" />
                {mode === 'card' ? 'AI 智能拆分' : mode === 'dialogue' ? 'AI 生成对话' : 'AI 生成视觉小说'}
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="p-10 flex flex-col items-center justify-center flex-1">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-lg font-medium text-gray-900 mb-2">{processingStatus}</p>
            <p className="text-sm text-gray-500">请稍候，AI 正在处理...</p>
          </div>
        )}
      </div>
    </div>
  );
}
