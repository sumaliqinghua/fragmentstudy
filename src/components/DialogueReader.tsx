import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, MessageCircle, ChevronRight, X, Send, Loader2, FileText } from 'lucide-react';
import type { Article, DialogueMessage, DialogueQA } from '../types';
import { getDialogueMessages, getDialogueQAs, saveDialogueQA, upsertProgress } from '../services/dataService';
import { answerDialogueQuestion } from '../services/openai';
import { isConfigured } from '../services/openai';
import { OriginalTextView } from './OriginalTextView';
import { idbGet } from '../services/localAssetStore';

interface DialogueReaderProps {
  article: Article;
  onBack: () => void;
}

function generateAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500',
    'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-violet-500',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.slice(0, 1).toUpperCase();
}

export function DialogueReader({ article, onBack }: DialogueReaderProps) {
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [qas, setQAs] = useState<DialogueQA[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<DialogueMessage | null>(null);
  const [showQAPanel, setShowQAPanel] = useState(false);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [pressedMessageId, setPressedMessageId] = useState<string | null>(null);
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [characterPortraits, setCharacterPortraits] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const qaPanelRef = useRef<HTMLDivElement>(null);
  const characterPortraitStorageKey = 'galgame_character_portraits_global';

  useEffect(() => {
    loadData();
  }, [article.id]);

  useEffect(() => {
    let cancelled = false;
    const loadPortraits = async () => {
      try {
        const stored = localStorage.getItem(characterPortraitStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, string>;
          if (!cancelled) {
            setCharacterPortraits(parsed);
          }
          return;
        }
        const idbStored = await idbGet(characterPortraitStorageKey);
        if (idbStored && !cancelled) {
          setCharacterPortraits(JSON.parse(idbStored) as Record<string, string>);
        } else if (!cancelled) {
          setCharacterPortraits({});
        }
      } catch (error) {
        console.warn('Failed to load character portraits:', error);
        if (!cancelled) {
          setCharacterPortraits({});
        }
      }
    };
    loadPortraits();
    return () => {
      cancelled = true;
    };
  }, [characterPortraitStorageKey]);

  useEffect(() => {
    if (messages.length > 0) {
      upsertProgress(article.id, messages.length - 1, messages.length);
    }
  }, [messages.length, article.id]);

  const loadData = async () => {
    try {
      const [messagesData, qasData] = await Promise.all([
        getDialogueMessages(article.id),
        getDialogueQAs(article.id),
      ]);
      setMessages(messagesData);
      setQAs(qasData);
    } catch (error) {
      console.error('Failed to load dialogue:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLongPressStart = useCallback((message: DialogueMessage) => {
    setPressedMessageId(message.id);
    const timer = window.setTimeout(() => {
      setSelectedMessage(message);
      setShowQAPanel(true);
      setPressedMessageId(null);
    }, 500);
    setLongPressTimer(timer);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setPressedMessageId(null);
  }, [longPressTimer]);

  const getContextMessages = useCallback((upToOrder: number) => {
    return messages
      .filter(m => m.sequence_order <= upToOrder)
      .map(m => ({ character_name: m.character_name, content: m.content }));
  }, [messages]);

  const handleAskQuestion = async () => {
    if (!question.trim() || !selectedMessage || !isConfigured()) return;

    setIsAsking(true);
    setStreamingAnswer('');

    const contextMessages = getContextMessages(selectedMessage.sequence_order);
    let fullAnswer = '';

    try {
      for await (const chunk of answerDialogueQuestion(question, contextMessages)) {
        fullAnswer += chunk;
        setStreamingAnswer(fullAnswer);
      }

      await saveDialogueQA(
        selectedMessage.id,
        article.id,
        question,
        fullAnswer,
        selectedMessage.sequence_order
      );

      setQAs(prev => [...prev, {
        id: crypto.randomUUID(),
        message_id: selectedMessage.id,
        article_id: article.id,
        question,
        answer: fullAnswer,
        context_up_to: selectedMessage.sequence_order,
        created_at: new Date().toISOString(),
      }]);

      setQuestion('');
    } catch (error) {
      console.error('Failed to ask question:', error);
    } finally {
      setIsAsking(false);
      setStreamingAnswer('');
    }
  };

  const selectedMessageQAs = selectedMessage
    ? qas.filter(qa => qa.message_id === selectedMessage.id)
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <div className={`flex-1 flex flex-col transition-all duration-300 ${showQAPanel ? 'mr-80' : ''}`}>
        <header className="bg-[#ededed] border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="text-center">
              <h1 className="font-medium text-gray-900 text-sm">{article.title}</h1>
              <p className="text-xs text-gray-500">{messages.length} 条消息</p>
            </div>
            <button
              onClick={() => setShowOriginalText(true)}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-700"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowQAPanel(!showQAPanel)}
              className={`p-2 -mr-2 rounded-full transition-colors ${
                showQAPanel ? 'bg-teal-100 text-teal-600' : 'hover:bg-gray-200 text-gray-700'
              }`}
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="text-center py-2">
            <span className="inline-block px-3 py-1 bg-gray-200 rounded-full text-xs text-gray-500">
              长按气泡可以向 AI 提问
            </span>
          </div>

          {messages.map((message) => {
            const isRight = message.is_right_side;
            const avatarColor = generateAvatarColor(message.avatar_seed);
            const isPressed = pressedMessageId === message.id;
            const portrait = characterPortraits[message.character_name];

            return (
              <div
                key={message.id}
                className={`flex gap-2 ${isRight ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-md flex items-center justify-center text-white font-medium shrink-0 ${
                    portrait ? 'bg-gray-200' : avatarColor
                  }`}
                >
                  {portrait ? (
                    <img
                      src={portrait}
                      alt={`${message.character_name}-portrait`}
                      className="w-full h-full rounded-md object-cover"
                    />
                  ) : (
                    getInitials(message.character_name)
                  )}
                </div>

                <div className={`max-w-[70%] ${isRight ? 'items-end' : 'items-start'}`}>
                  <p className={`text-xs text-gray-500 mb-1 ${isRight ? 'text-right' : ''}`}>
                    {message.character_name}
                  </p>
                  <div
                    onMouseDown={() => handleLongPressStart(message)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={() => handleLongPressStart(message)}
                    onTouchEnd={handleLongPressEnd}
                    className={`relative px-3 py-2 rounded-lg cursor-pointer select-none transition-all ${
                      isRight
                        ? 'bg-[#95ec69] text-gray-900'
                        : 'bg-white text-gray-900'
                    } ${isPressed ? 'scale-95 opacity-80' : ''}`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <div
                      className={`absolute top-3 w-0 h-0 border-8 border-transparent ${
                        isRight
                          ? '-right-2 border-l-[#95ec69] border-r-0'
                          : '-left-2 border-r-white border-l-0'
                      }`}
                    />
                  </div>
                  {message.knowledge_point && (
                    <p className={`text-xs text-gray-400 mt-1 ${isRight ? 'text-right' : ''}`}>
                      {message.knowledge_point}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div
        ref={qaPanelRef}
        className={`fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 z-20 ${
          showQAPanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-teal-600" />
            <h2 className="font-medium text-gray-900">AI 问答</h2>
          </div>
          <button
            onClick={() => setShowQAPanel(false)}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {selectedMessage ? (
          <>
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-gray-500 mb-1">当前选中的消息</p>
              <p className="text-sm text-gray-700 line-clamp-3">{selectedMessage.content}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedMessageQAs.length === 0 && !streamingAnswer && (
                <div className="text-center py-8">
                  <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">还没有问答记录</p>
                  <p className="text-xs text-gray-400 mt-1">在下方输入你的问题</p>
                </div>
              )}

              {selectedMessageQAs.map((qa) => (
                <div key={qa.id} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="bg-teal-500 text-white px-3 py-2 rounded-lg rounded-tr-sm max-w-[85%]">
                      <p className="text-sm">{qa.question}</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg rounded-tl-sm max-w-[85%]">
                      <p className="text-sm whitespace-pre-wrap">{qa.answer}</p>
                    </div>
                  </div>
                </div>
              ))}

              {streamingAnswer && (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <div className="bg-teal-500 text-white px-3 py-2 rounded-lg rounded-tr-sm max-w-[85%]">
                      <p className="text-sm">{question}</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg rounded-tl-sm max-w-[85%]">
                      <p className="text-sm whitespace-pre-wrap">{streamingAnswer}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAskQuestion()}
                  placeholder="输入你的问题..."
                  disabled={isAsking}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={!question.trim() || isAsking}
                  className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isAsking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChevronRight className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">长按左侧对话气泡</p>
              <p className="text-gray-400 text-xs mt-1">选择想要提问的内容</p>
            </div>
          </div>
        )}
      </div>

      <OriginalTextView
        isOpen={showOriginalText}
        articleId={article.id}
        originalContent={article.original_content}
        currentText={selectedMessage?.content || messages[messages.length - 1]?.content}
        onClose={() => setShowOriginalText(false)}
      />
    </div>
  );
}
