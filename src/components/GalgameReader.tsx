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
const EMOTION_LABELS: Record<string, string> = {
  sweat: '紧张',
  angry: '生气',
  love: '心动',
  shock: '震惊',
  question: '疑问',
  happy: '开心',
  think: '思考',
  sad: '难过',
};
type EmotionKey = keyof typeof EMOTION_EMOJIS;

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
  const [showPortraitSettings, setShowPortraitSettings] = useState(false);
  const [emotionPortraits, setEmotionPortraits] = useState<Record<string, string>>({});
  const [showCharacterPortraitSettings, setShowCharacterPortraitSettings] = useState(false);
  const [characterPortraits, setCharacterPortraits] = useState<Record<string, string>>({});
  const [portraitWidth, setPortraitWidth] = useState(320);
  const [displayMode, setDisplayMode] = useState<'stage' | 'bubble'>('stage');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [dialogueBarHeight, setDialogueBarHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const dialogueBarRef = useRef<HTMLDivElement>(null);
  const autoPlayTimerRef = useRef<number | null>(null);
  const portraitStorageKey = `galgame_emotion_portraits_${article.id}`;
  const characterPortraitStorageKey = `galgame_character_portraits_${article.id}`;
  const portraitWidthStorageKey = `galgame_portrait_width_${article.id}`;
  const displayModeStorageKey = `galgame_display_mode_${article.id}`;
  const backgroundStorageKey = `galgame_background_${article.id}`;

  useEffect(() => {
    loadMessages();
  }, [article.id]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(portraitStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        setEmotionPortraits(parsed);
      } else {
        setEmotionPortraits({});
      }
    } catch (error) {
      console.warn('Failed to load emotion portraits:', error);
      setEmotionPortraits({});
    }
  }, [portraitStorageKey]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(portraitWidthStorageKey);
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed)) {
          setPortraitWidth(parsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load portrait width:', error);
    }
  }, [portraitWidthStorageKey]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(displayModeStorageKey);
      if (stored === 'stage' || stored === 'bubble') {
        setDisplayMode(stored);
      }
    } catch (error) {
      console.warn('Failed to load display mode:', error);
    }
  }, [displayModeStorageKey]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(backgroundStorageKey);
      if (stored) {
        setBackgroundImage(stored);
      }
    } catch (error) {
      console.warn('Failed to load background image:', error);
    }
  }, [backgroundStorageKey]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(characterPortraitStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string>;
        setCharacterPortraits(parsed);
      } else {
        setCharacterPortraits({});
      }
    } catch (error) {
      console.warn('Failed to load character portraits:', error);
      setCharacterPortraits({});
    }
  }, [characterPortraitStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(portraitStorageKey, JSON.stringify(emotionPortraits));
    } catch (error) {
      console.warn('Failed to save emotion portraits:', error);
    }
  }, [emotionPortraits, portraitStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(characterPortraitStorageKey, JSON.stringify(characterPortraits));
    } catch (error) {
      console.warn('Failed to save character portraits:', error);
    }
  }, [characterPortraits, characterPortraitStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(portraitWidthStorageKey, String(portraitWidth));
    } catch (error) {
      console.warn('Failed to save portrait width:', error);
    }
  }, [portraitWidth, portraitWidthStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(displayModeStorageKey, displayMode);
    } catch (error) {
      console.warn('Failed to save display mode:', error);
    }
  }, [displayMode, displayModeStorageKey]);

  useEffect(() => {
    try {
      if (backgroundImage) {
        localStorage.setItem(backgroundStorageKey, backgroundImage);
      } else {
        localStorage.removeItem(backgroundStorageKey);
      }
    } catch (error) {
      console.warn('Failed to save background image:', error);
    }
  }, [backgroundImage, backgroundStorageKey]);

  useEffect(() => {
    if (!dialogueBarRef.current) {
      return;
    }
    const node = dialogueBarRef.current;
    const updateHeight = () => setDialogueBarHeight(node.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  const handlePortraitUpload = (emotion: EmotionKey, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setEmotionPortraits(prev => ({ ...prev, [emotion]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handlePortraitClear = (emotion: EmotionKey) => {
    setEmotionPortraits(prev => {
      const next = { ...prev };
      delete next[emotion];
      return next;
    });
  };

  const handleCharacterPortraitUpload = (characterName: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCharacterPortraits(prev => ({ ...prev, [characterName]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleCharacterPortraitClear = (characterName: string) => {
    setCharacterPortraits(prev => {
      const next = { ...prev };
      delete next[characterName];
      return next;
    });
  };

  const handleBackgroundUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundImage(reader.result as string);
    };
    reader.readAsDataURL(file);
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
  const currentEmotion = currentMessage.emotion_emoji as EmotionKey | undefined;
  const currentEmotionPortrait = currentEmotion ? emotionPortraits[currentEmotion] : undefined;

  const leftCharacter = currentMessage.position === 'left' || currentMessage.position === 'center' ? currentMessage : null;
  const rightCharacter = currentMessage.position === 'right' ? currentMessage : null;
  const characterNames = Array.from(new Set(messages.map(msg => msg.character_name)));
  const portraitHeight = Math.round(portraitWidth * 1.45);
  const portraitAreaPadding = Math.max(160, dialogueBarHeight + 8);
  const isBubbleMode = displayMode === 'bubble';
  const bubbleSide = currentMessage.position === 'right'
    ? 'right'
    : currentMessage.position === 'left'
      ? 'left'
      : currentIndex % 2 === 0
        ? 'left'
        : 'right';

  return (
    <div
      ref={containerRef}
      className={`h-screen bg-gray-900 flex flex-col relative overflow-hidden ${getScreenEffectClass()}`}
      onClick={handleClick}
    >
      <div className="absolute inset-0 pointer-events-none">
        {backgroundImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/10" />
      </div>
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
            <div>
              <label className="text-sm text-gray-400 block mb-2">立绘宽度</label>
              <input
                type="range"
                min="60"
                max="580"
                value={portraitWidth}
                onChange={(e) => setPortraitWidth(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>窄</span>
                <span>宽</span>
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
            <button
              onClick={() => setShowPortraitSettings(true)}
              className="w-full px-3 py-2 text-sm text-gray-200 bg-gray-700/60 hover:bg-gray-600/80 rounded-lg transition-colors"
            >
              情绪立绘
            </button>
            <button
              onClick={() => setShowCharacterPortraitSettings(true)}
              className="w-full px-3 py-2 text-sm text-gray-200 bg-gray-700/60 hover:bg-gray-600/80 rounded-lg transition-colors"
            >
              人物立绘
            </button>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">显示形式</span>
              <button
                onClick={() => setDisplayMode(displayMode === 'stage' ? 'bubble' : 'stage')}
                className={`w-16 h-7 rounded-full transition-colors ${displayMode === 'bubble' ? 'bg-teal-500' : 'bg-gray-600'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full transition-transform ${displayMode === 'bubble' ? 'translate-x-9' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-400">背景图</span>
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 text-xs text-gray-200 bg-gray-700 hover:bg-gray-600 rounded-md cursor-pointer transition-colors">
                  上传
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }
                      handleBackgroundUpload(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {backgroundImage && (
                  <button
                    onClick={() => setBackgroundImage(null)}
                    className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md border border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    清除
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 flex items-end justify-center pt-20 px-4" style={{ paddingBottom: portraitAreaPadding }}>
        {!isBubbleMode && (
          <div className="flex items-end justify-center gap-8 w-full max-w-4xl">
            {leftCharacter && (
              <div className="flex flex-col items-center animate-float">
                <div className="relative">
                  {currentEmotionPortrait ? (
                    <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full ring-2 ring-white/30 shadow-lg overflow-hidden z-10">
                      <img
                        src={currentEmotionPortrait}
                        alt={`${leftCharacter.character_name}-${currentEmotion}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    emotionEmoji && currentMessage.position !== 'right' && (
                      <div className="absolute -top-4 -right-4 text-3xl animate-bounce z-10">
                        {emotionEmoji}
                      </div>
                    )
                  )}
                  {characterPortraits[leftCharacter.character_name] ? (
                    <div
                      className="rounded-2xl shadow-2xl overflow-hidden"
                      style={{ width: portraitWidth, height: portraitHeight }}
                    >
                      <img
                        src={characterPortraits[leftCharacter.character_name]}
                        alt={`${leftCharacter.character_name}-portrait`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-2xl ring-4 ring-white/20`}>
                      {getInitials(leftCharacter.character_name)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightCharacter && (
              <div className="flex flex-col items-center animate-float" style={{ animationDelay: '0.5s' }}>
                <div className="relative">
                  {currentEmotionPortrait ? (
                    <div className="absolute -top-2 -left-2 w-10 h-10 rounded-full ring-2 ring-white/30 shadow-lg overflow-hidden z-10">
                      <img
                        src={currentEmotionPortrait}
                        alt={`${rightCharacter.character_name}-${currentEmotion}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    emotionEmoji && (
                      <div className="absolute -top-4 -left-4 text-3xl animate-bounce z-10">
                        {emotionEmoji}
                      </div>
                    )
                  )}
                  {characterPortraits[rightCharacter.character_name] ? (
                    <div
                      className="rounded-2xl shadow-2xl overflow-hidden"
                      style={{ width: portraitWidth, height: portraitHeight }}
                    >
                      <img
                        src={characterPortraits[rightCharacter.character_name]}
                        alt={`${rightCharacter.character_name}-portrait`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br ${generateAvatarColor(rightCharacter.avatar_seed)} flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-2xl ring-4 ring-white/20`}>
                      {getInitials(rightCharacter.character_name)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isBubbleMode && (
          <div className={`w-full max-w-4xl flex items-center ${bubbleSide === 'right' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-center gap-4 ${bubbleSide === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="flex flex-col items-center">
                <div className="relative">
                  {currentEmotionPortrait ? (
                    <div className={`absolute -top-2 ${bubbleSide === 'right' ? '-left-2' : '-right-2'} w-10 h-10 rounded-full ring-2 ring-white/30 shadow-lg overflow-hidden z-10`}>
                      <img
                        src={currentEmotionPortrait}
                        alt={`${currentMessage.character_name}-${currentEmotion}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    emotionEmoji && (
                      <div className={`absolute -top-4 ${bubbleSide === 'right' ? '-left-4' : '-right-4'} text-3xl animate-bounce z-10`}>
                        {emotionEmoji}
                      </div>
                    )
                  )}
                  {characterPortraits[currentMessage.character_name] ? (
                    <div
                      className="rounded-2xl shadow-2xl overflow-hidden"
                      style={{ width: portraitWidth, height: portraitHeight }}
                    >
                      <img
                        src={characterPortraits[currentMessage.character_name]}
                        alt={`${currentMessage.character_name}-portrait`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-2xl ring-4 ring-white/20`}>
                      {getInitials(currentMessage.character_name)}
                    </div>
                  )}
                </div>
                <span className="mt-2 text-xs text-teal-300">{currentMessage.character_name}</span>
              </div>
              <div className="relative w-[320px] max-w-[70vw]">
                <div className={`absolute top-1/2 ${bubbleSide === 'right' ? 'right-[-6px]' : 'left-[-6px]'} w-3 h-3 -translate-y-1/2 bg-white/15 rotate-45 border ${bubbleSide === 'right' ? 'border-r border-b' : 'border-l border-b'} border-white/10`} />
                <div className="rounded-2xl bg-white/15 border border-white/15 px-5 py-4 text-white backdrop-blur-sm shadow-xl">
                  {currentMessage.knowledge_point && (
                    <span className="inline-block mb-2 text-xs text-teal-200 bg-black/30 px-2 py-1 rounded">
                      {currentMessage.knowledge_point}
                    </span>
                  )}
                  <p className="text-base leading-relaxed">
                    {displayedText}
                    {isTyping && <span className="inline-block w-0.5 h-5 bg-white ml-1 animate-blink" />}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {!isBubbleMode && (
        <div
          ref={dialogueBarRef}
          className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/95 to-black/80 backdrop-blur-sm"
          onClick={e => e.stopPropagation()}
        >
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
      )}

      {isBubbleMode && (
        <div
          ref={dialogueBarRef}
          className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-6 pt-2 flex items-center justify-between text-xs text-gray-400"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              上一句
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === messages.length - 1}
              className="px-3 py-1.5 rounded-full border border-white/10 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              下一句
            </button>
          </div>
          {!isTyping && currentIndex < messages.length - 1 && (
            <div className="flex items-center gap-2">
              <span>点击继续</span>
              <ChevronDown className="w-4 h-4 animate-bounce" />
            </div>
          )}
          {currentIndex === messages.length - 1 && !isTyping && (
            <span className="text-teal-300">已到结尾</span>
          )}
        </div>
      )}

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

      {showPortraitSettings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col" onClick={() => setShowPortraitSettings(false)}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-medium">情绪立绘</h2>
            <button onClick={() => setShowPortraitSettings(false)} className="p-2 hover:bg-white/10 rounded-full">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4" onClick={e => e.stopPropagation()}>
            {(Object.keys(EMOTION_EMOJIS) as EmotionKey[]).map((emotion) => {
              const portrait = emotionPortraits[emotion];
              return (
                <div
                  key={emotion}
                  className="flex items-center gap-4 p-3 rounded-xl bg-gray-800/60 border border-gray-700"
                >
                  <div className="text-2xl w-10 text-center">{EMOTION_EMOJIS[emotion]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{EMOTION_LABELS[emotion]}</span>
                      <span className="text-xs text-gray-500">{emotion}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      {portrait ? (
                        <img
                          src={portrait}
                          alt={`${EMOTION_LABELS[emotion]}-portrait`}
                          className="w-16 h-20 rounded-lg object-contain bg-black/40 border border-gray-700"
                        />
                      ) : (
                        <div className="w-16 h-20 rounded-lg bg-gray-700/60 border border-gray-600 flex items-center justify-center text-xs text-gray-400">
                          默认
                        </div>
                      )}
                      <label className="px-3 py-1.5 text-xs text-gray-200 bg-gray-700 hover:bg-gray-600 rounded-md cursor-pointer transition-colors">
                        上传
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }
                            handlePortraitUpload(emotion, file);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                      {portrait && (
                        <button
                          onClick={() => handlePortraitClear(emotion)}
                          className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md border border-gray-600 hover:border-gray-500 transition-colors"
                        >
                          清除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-gray-500">情绪立绘只替换表情显示，保存在本地浏览器。</p>
          </div>
        </div>
      )}

      {showCharacterPortraitSettings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col" onClick={() => setShowCharacterPortraitSettings(false)}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-medium">人物立绘</h2>
            <button onClick={() => setShowCharacterPortraitSettings(false)} className="p-2 hover:bg-white/10 rounded-full">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4" onClick={e => e.stopPropagation()}>
            {characterNames.map((name) => {
              const portrait = characterPortraits[name];
              return (
                <div
                  key={name}
                  className="flex items-center gap-4 p-3 rounded-xl bg-gray-800/60 border border-gray-700"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${generateAvatarColor(name)} flex items-center justify-center text-white text-lg font-bold`}>
                    {getInitials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{name}</div>
                    <div className="mt-2 flex items-center gap-3">
                      {portrait ? (
                        <img
                          src={portrait}
                          alt={`${name}-portrait`}
                          className="w-16 h-20 rounded-lg object-contain bg-black/40 border border-gray-700"
                        />
                      ) : (
                        <div className="w-16 h-20 rounded-lg bg-gray-700/60 border border-gray-600 flex items-center justify-center text-xs text-gray-400">
                          默认
                        </div>
                      )}
                      <label className="px-3 py-1.5 text-xs text-gray-200 bg-gray-700 hover:bg-gray-600 rounded-md cursor-pointer transition-colors">
                        上传
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) {
                              return;
                            }
                            handleCharacterPortraitUpload(name, file);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                      {portrait && (
                        <button
                          onClick={() => handleCharacterPortraitClear(name)}
                          className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md border border-gray-600 hover:border-gray-500 transition-colors"
                        >
                          清除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-gray-500">人物立绘只保存在本地浏览器，不会上传到云端。</p>
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
