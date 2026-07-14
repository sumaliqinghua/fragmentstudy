import { useState, useRef, useEffect } from 'react';
import { X, Send, BookOpen, Lightbulb, Link2, Loader2, History } from 'lucide-react';
import { explainCard, isConfigured } from '../services/openai';
import { getConversations, saveConversation } from '../services/dataService';
import type { Card, AIConversation } from '../types';

interface AIChatProps {
  isOpen: boolean;
  currentCard: Card | null;
  previousCards: Card[];
  onClose: () => void;
  onConversationSaved: () => void;
}

type QuestionType = 'story' | 'beginner' | 'connect' | 'custom';

const presetButtons: { type: QuestionType; label: string; icon: React.ReactNode }[] = [
  { type: 'story', label: '用故事类比', icon: <BookOpen className="w-4 h-4" /> },
  { type: 'beginner', label: '零基础解释', icon: <Lightbulb className="w-4 h-4" /> },
  { type: 'connect', label: '串联前文讲解', icon: <Link2 className="w-4 h-4" /> },
];

const questionTypeLabels: Record<string, string> = {
  story: '用故事类比',
  beginner: '零基础解释',
  connect: '串联前文讲解',
  custom: '自定义问题',
};

export function AIChat({ isOpen, currentCard, previousCards, onClose, onConversationSaved }: AIChatProps) {
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && currentCard) {
      loadConversations();
      setResponse('');
      setError('');
      setCustomQuestion('');
      setCurrentQuestion('');
    }
  }, [isOpen, currentCard?.id]);

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response, conversations, showHistory]);

  const loadConversations = async () => {
    if (!currentCard) return;
    try {
      const data = await getConversations(currentCard.id);
      setConversations(data);
      setShowHistory(data.length > 0);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const handleAsk = async (questionType: QuestionType, question?: string) => {
    if (!currentCard) return;

    if (!isConfigured()) {
      setError('请先在设置中配置 API Key');
      return;
    }

    const questionText = questionType === 'custom'
      ? question || ''
      : questionTypeLabels[questionType];

    setIsLoading(true);
    setResponse('');
    setError('');
    setCurrentQuestion(questionText);
    setShowHistory(false);

    let fullResponse = '';

    try {
      const generator = explainCard({
        cardContent: currentCard.content,
        previousCards: previousCards.map(c => c.content),
        questionType,
        customQuestion: question,
      });

      for await (const chunk of generator) {
        fullResponse += chunk;
        setResponse(fullResponse);
      }

      await saveConversation(currentCard.id, questionType, questionText, fullResponse);
      onConversationSaved();
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSubmit = () => {
    if (customQuestion.trim()) {
      handleAsk('custom', customQuestion.trim());
      setCustomQuestion('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">问 AI</h3>
            {conversations.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  showHistory
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                历史 ({conversations.length})
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {currentCard && (
          <div className="shrink-0 px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1">当前卡片</p>
            <p className="text-sm text-gray-700 line-clamp-2">{currentCard.content}</p>
          </div>
        )}

        <div className="shrink-0 p-4 border-b border-gray-100">
          <p className="text-sm text-gray-600 mb-3">选择问题类型</p>
          <div className="flex flex-wrap gap-2">
            {presetButtons.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => handleAsk(type)}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 rounded-xl text-sm font-medium hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={responseRef}
          className="flex-1 overflow-y-auto p-5 min-h-[200px]"
        >
          {showHistory && conversations.length > 0 && (
            <div className="space-y-4 mb-4">
              {conversations.map((conv) => (
                <div key={conv.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">
                      {questionTypeLabels[conv.question_type] || conv.question}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(conv.created_at).toLocaleString('zh-CN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {conv.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showHistory && (
            <>
              {isLoading && !response && (
                <div className="flex items-center gap-3 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>AI 思考中...</span>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {response && (
                <div>
                  {currentQuestion && (
                    <div className="mb-3 px-3 py-1.5 bg-teal-50 rounded-lg inline-block">
                      <span className="text-xs font-medium text-teal-700">{currentQuestion}</span>
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {response}
                    </p>
                  </div>
                </div>
              )}

              {!isLoading && !error && !response && (
                <div className="text-center py-8 text-gray-400">
                  <p>点击上方按钮或输入问题</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              placeholder="输入自定义问题..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm disabled:bg-gray-50"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={isLoading || !customQuestion.trim()}
              className="px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
