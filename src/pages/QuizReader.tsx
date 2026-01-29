import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { getArticle, getQuizQuestions } from '../services/dataService';
import { StreakModal } from '../components/StreakModal';
import { getStreakDays, recordStreak } from '../utils/streak';
import type { Article, QuizQuestion } from '../types';

interface QuizReaderProps {
  articleId: string;
  onBack: () => void;
}

export function QuizReader({ articleId, onBack }: QuizReaderProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lives, setLives] = useState(5);
  const [showStreak, setShowStreak] = useState(false);
  const [streakDays, setStreakDays] = useState(() => getStreakDays());

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [articleData, quizData] = await Promise.all([
          getArticle(articleId),
          getQuizQuestions(articleId),
        ]);
        setArticle(articleData);
        setQuestions(quizData);
      } catch (err) {
        console.error('Failed to load quiz:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [articleId]);

  const currentQuestion = questions[currentIndex];
  const total = questions.length;
  const progressPercent = useMemo(() => {
    if (!total) return 0;
    return Math.round((currentIndex / total) * 100);
  }, [currentIndex, total]);

  const isAnswered = checked && selectedOption !== null;
  const isCorrect = isAnswered && selectedOption === currentQuestion?.correct_index;
  const isLastQuestion = currentIndex >= total - 1;

  const handleCheck = () => {
    if (selectedOption === null || !currentQuestion) return;
    setChecked(true);
    if (selectedOption !== currentQuestion.correct_index) {
      setLives((prev) => Math.max(0, prev - 1));
    }
  };

  const handleNext = () => {
    if (!isAnswered) return;
    if (isLastQuestion) {
      const result = recordStreak({ forceShow: true });
      setStreakDays(result.streakDays);
      if (result.shouldShow) {
        setShowStreak(true);
      } else {
        onBack();
      }
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setChecked(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-white">
        <header className="flex items-center gap-4 px-4 pt-6 pb-2 sticky top-0 bg-white z-10">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">问答模式</h1>
        </header>
        <div className="px-5 py-10 text-center text-slate-500">还没有问答题目</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex flex-col w-full px-4 pt-6 pb-2 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors text-slate-400"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full relative" style={{ width: `${progressPercent}%` }}>
              <div className="absolute top-1 right-2 w-8 h-1.5 bg-white/30 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-1 text-red-500">
            <Heart className="w-6 h-6 fill-red-500" />
            <span className="font-bold text-lg">{lives}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col px-5 max-w-md mx-auto w-full pb-32">
        <div className="flex items-center justify-center mt-4 mb-6">
          <span className="text-primary text-xs font-bold uppercase tracking-widest bg-primary/10 px-4 py-1.5 rounded-full">
            Question {currentIndex + 1} of {total}
          </span>
        </div>
        <div className="flex flex-col gap-6 mb-8">
          <h2 className="text-2xl font-bold leading-tight text-center text-slate-800">
            {currentQuestion.question}
          </h2>
          {article && (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm bg-slate-50 py-2 px-4 rounded-lg self-center border border-slate-100">
              <span className="font-medium">From "{article.title}"</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 w-full" role="radiogroup">
          {currentQuestion.options.map((option, optionIndex) => {
            const isSelected = selectedOption === optionIndex;
            const isRightOption = optionIndex === currentQuestion.correct_index;
            const showCorrect = isAnswered && isRightOption;
            const showWrong = isAnswered && isSelected && !isRightOption;

            return (
              <button
                key={`${currentQuestion.id}-${optionIndex}`}
                type="button"
                onClick={() => {
                  if (checked) return;
                  setSelectedOption(optionIndex);
                }}
                className={`group relative flex items-center w-full p-4 rounded-2xl transition-all border-2 ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-[0_2px_0_#58cc02]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 shadow-[0_2px_0_#e2e8f0]'
                } ${checked ? 'cursor-default' : 'active:translate-y-[2px] active:shadow-none'}`}
              >
                <div className="flex-1 pr-3 text-left">
                  <p className={`text-lg ${isSelected ? 'font-semibold text-slate-800' : 'font-medium text-slate-600 group-hover:text-slate-800'}`}>
                    {option}
                  </p>
                </div>
                {(showCorrect || showWrong) && (
                  <span className={`text-xs font-bold ${showCorrect ? 'text-primary' : 'text-red-500'}`}>
                    {showCorrect ? '正确' : '错误'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={`mt-6 p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
            <p className="text-sm text-slate-700">
              <span className="font-semibold">解析：</span>
              {currentQuestion.explanation || '暂无解析'}
            </p>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full bg-white border-t border-slate-100 p-4 pb-8 z-20">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          <div className="flex justify-between px-2">
            <button className="text-sm font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider">
              Hint
            </button>
            <button
              onClick={() => {
                if (!currentQuestion) return;
                const fallbackOption = currentQuestion.correct_index === 0 ? 1 : 0;
                const skipOption = Math.min(fallbackOption, currentQuestion.options.length - 1);
                setSelectedOption(skipOption);
                setChecked(true);
                setLives((prev) => Math.max(0, prev - 1));
              }}
              className="text-sm font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider"
            >
              Skip
            </button>
          </div>
          <button
            onClick={isAnswered ? handleNext : handleCheck}
            disabled={!isAnswered && selectedOption === null}
            className="w-full bg-primary hover:bg-[#4ac102] text-white text-lg font-extrabold py-4 rounded-2xl shadow-[0_4px_0_#46a302] active:shadow-none active:translate-y-[4px] transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isAnswered ? (isLastQuestion ? 'Finish' : 'Next') : 'Check Answer'}
          </button>
        </div>
      </footer>

      <StreakModal
        isOpen={showStreak}
        streakDays={streakDays}
        onClose={() => {
          setShowStreak(false);
          onBack();
        }}
      />
    </div>
  );
}
