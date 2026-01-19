import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, History, X, ChevronDown, Settings2, FileText } from 'lucide-react';
import type { Article, GalgameMessage } from '../types';
import { getGalgameMessages, upsertProgress } from '../services/dataService';
import { OriginalTextView } from './OriginalTextView';

interface GalgameReaderProps {
  article: Article;
  onBack: () => void;
}

const EMOTION_EMOJIS: Record<string, string> = {
  sweat: '💧',
  angry: '💢',
  love: '💕',
  shock: '❗',
  question: '❓',
  happy: '✨',
  think: '💭',
  sad: '💔',
};

function generateAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'from-rose-400 to-rose-600',
    'from-orange-400 to-orange-600',
    'from-amber-400 to-amber-600',
    'from-emerald-400 to-emerald-600',
    'from-teal-400 to-teal-600',
    'from-cyan-400 to-cyan-600',
    'from-blue-400 to-blue-600',
    'from-sky-400 to-sky-600',
  ];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.slice(0, 2);
}

export function GalgameReader({ article, onBack }: GalgameReaderProps) {
  const [messages, setMessages] = useState<GalgameMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [screenEffect, setScreenEffect] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [textSpeed, setTextSpeed] = useState(50);
  const [showSettings, setShowSettings] = useState(false);
  const [showOriginalText, setShowOriginalText] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const autoPlayTimerRef = useRef<number | null>(null);

  useEffect(() => {
    loadMessages();
  }, [article.id]);

  useEffect(() => {
    if (messages.length > 0) {
      upsertProgress(article.id, currentIndex, messages.length);
    }
  }, [currentIndex, messages.length, article.id]);

  useEffect(() => {
    if (messages.length > 0 && currentIndex < messages.length) {
      typeText(messages[currentIndex].content);
      triggerScreenEffect(messages[currentIndex].screen_effect);
    }
  }, [currentIndex, messages]);

  useEffect(() => {
    if (autoPlay && !isTyping && currentIndex < messages.length - 1) {
      autoPlayTimerRef.current = window.setTimeout(() => {
        handleNext();
      }, 2000);
    }
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [autoPlay, isTyping, currentIndex, messages.length]);

  const loadMessages = async () => {
    try {
      const data = await getGalgameMessages(article.id);
      setMessages(data);
      if (data.length > 0) {
        typeText(data[0].content);
        triggerScreenEffect(data[0].screen_effect);
      }
    } catch (error) {
      console.error('Failed to load galgame messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const typeText = useCallback((text: string) => {
    setIsTyping(true);
    setDisplayedText('');
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, textSpeed);

    return () => clearInterval(interval);
  }, [textSpeed]);

  const triggerScreenEffect = (effect: string) => {
    if (effect && effect !== 'none') {
      setScreenEffect(effect);
      setTimeout(() => setScreenEffect(null), 500);
    }
  };

  const handleClick = () => {
    if (isTyping) {
      setDisplayedText(messages[currentIndex].content);
      setIsTyping(false);
    } else {
      handleNext();
    }
  };

  const handleNext = () => {
    if (currentIndex < messages.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const jumpToMessage = (index: number) => {
    setCurrentIndex(index);
    setShowHistory(false);
  };

  const getScreenEffectClass = () => {
    switch (screenEffect) {
      case 'shake':
        return 'animate-shake';
      case 'flash':
        return 'animate-flash';
      case 'pulse':
        return 'animate-pulse-effect';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>暂无内容</p>
          <button onClick={onBack} className="mt-4 text-teal-400 hover:underline">返回</button>
        </div>
      </div>
    );
  }

  const currentMessage = messages[currentIndex];
  const avatarColor = generateAvatarColor(currentMessage.avatar_seed);
  const emotionEmoji = currentMessage.emotion_emoji ? EMOTION_EMOJIS[currentMessage.emotion_emoji] : null;

  const leftCharacter = currentMessage.position === 'left' || currentMessage.position === 'center' ? currentMessage : null;
  const rightCharacter = currentMessage.position === 'right' ? currentMessage : null;

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col relative overflow-hidden ${getScreenEffectClass()}`}
      onClick={handleClick}
    >
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        @keyframes flash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; background: white; }
        }
        @keyframes pulse-effect {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        .animate-flash { animation: flash 0.3s ease-in-out; }
        .animate-pulse-effect { animation: pulse-effect 0.5s ease-in-out; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-blink { animation: blink 1s ease-in-out infinite; }
      `}</style>

      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent" onClick={e => e.stopPropagation()}>
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="text-center">
          <h1 className="font-medium text-white text-sm">{article.title}</h1>
          <p className="text-xs text-gray-400">{currentIndex + 1} / {messages.length}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowOriginalText(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <FileText className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Settings2 className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <History className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      {showSettings && (
        <div
          className="absolute top-16 right-4 z-30 bg-gray-800 rounded-xl p-4 shadow-2xl border border-gray-700 w-64"
          onClick={e => e.stopPropagation()}
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">文字速度</label>
              <input
                type="range"
                min="20"
                max="100"
                value={100 - textSpeed}
                onChange={(e) => setTextSpeed(100 - parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>慢</span>
                <span>快</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">自动播放</span>
              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={`w-12 h-6 rounded-full transition-colors ${autoPlay ? 'bg-teal-500' : 'bg-gray-600'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${autoPlay ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-end justify-center pb-48 pt-20 px-4">
        <div className="flex items-end justify-center gap-8 w-full max-w-4xl">
          {leftCharacter && (
            <div className="flex flex-col items-center animate-float">
              <div className="relative">
                {emotionEmoji && currentMessage.position !== 'right' && (
                  <div className="absolute -top-4 -right-4 text-3xl animate-bounce z-10">
                    {emotionEmoji}
                  </div>
                )}
                <div className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-2xl ring-4 ring-white/20`}>
                  {getInitials(leftCharacter.character_name)}
                </div>
              </div>
            </div>
          )}

          {rightCharacter && (
            <div className="flex flex-col items-center animate-float" style={{ animationDelay: '0.5s' }}>
              <div className="relative">
                {emotionEmoji && (
                  <div className="absolute -top-4 -left-4 text-3xl animate-bounce z-10">
                    {emotionEmoji}
                  </div>
                )}
                <div className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br ${generateAvatarColor(rightCharacter.avatar_seed)} flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-2xl ring-4 ring-white/20`}>
                  {getInitials(rightCharacter.character_name)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-black/80 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-sm font-bold`}>
              {getInitials(currentMessage.character_name)}
            </div>
            <span className="text-teal-400 font-medium">{currentMessage.character_name}</span>
            {currentMessage.knowledge_point && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                {currentMessage.knowledge_point}
              </span>
            )}
          </div>

          <div className="min-h-[80px] flex items-start">
            <p className="text-white text-lg leading-relaxed">
              {displayedText}
              {isTyping && <span className="inline-block w-0.5 h-5 bg-white ml-1 animate-blink" />}
            </p>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-800">
            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                上一句
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === messages.length - 1}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                下一句
              </button>
            </div>

            {!isTyping && currentIndex < messages.length - 1 && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <span>点击继续</span>
                <ChevronDown className="w-4 h-4 animate-bounce" />
              </div>
            )}

            {currentIndex === messages.length - 1 && !isTyping && (
              <span className="text-teal-400 text-sm">已到结尾</span>
            )}
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col" onClick={() => setShowHistory(false)}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-medium">对话历史</h2>
            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/10 rounded-full">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3" onClick={e => e.stopPropagation()}>
            {messages.slice(0, currentIndex + 1).map((msg, index) => (
              <button
                key={msg.id}
                onClick={() => jumpToMessage(index)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  index === currentIndex ? 'bg-teal-900/50 border border-teal-500/50' : 'bg-gray-800/50 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded bg-gradient-to-br ${generateAvatarColor(msg.avatar_seed)} flex items-center justify-center text-white text-xs font-bold`}>
                    {getInitials(msg.character_name)}
                  </div>
                  <span className="text-teal-400 text-sm font-medium">{msg.character_name}</span>
                  <span className="text-gray-600 text-xs">#{index + 1}</span>
                </div>
                <p className="text-gray-300 text-sm line-clamp-2">{msg.content}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <OriginalTextView
        isOpen={showOriginalText}
        articleId={article.id}
        originalContent={article.original_content}
        currentText={currentMessage?.content}
        onClose={() => setShowOriginalText(false)}
      />
    </div>
  );
}
