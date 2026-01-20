import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import { getArticle, getQuizQuestions } from '../services/dataService';
import type { Article, QuizQuestion } from '../types';

interface QuizReaderProps {
  articleId: string;
  onBack: () => void;
}

export function QuizReader({ articleId, onBack }: QuizReaderProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

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

  const stats = useMemo(() => {
    const answered = Object.keys(selectedOptions).length;
    const correct = questions.filter(q => selectedOptions[q.id] === q.correct_index).length;
    return { answered, correct, total: questions.length };
  }, [questions, selectedOptions]);

  const handleSelect = (questionId: string, optionIndex: number) => {
    setSelectedOptions(prev => ({ ...prev, [questionId]: optionIndex }));
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
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {article?.title || '问答模式'}
            </h1>
            <p className="text-xs text-gray-500">
              已答 {stats.answered}/{stats.total}，正确 {stats.correct}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {questions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-5 h-5 text-violet-600" />
            </div>
            <p className="text-gray-600">还没有问答题目</p>
          </div>
        ) : (
          questions.map((question, index) => {
            const selected = selectedOptions[question.id];
            const isAnswered = selected !== undefined;
            const isCorrect = selected === question.correct_index;

            return (
              <div key={question.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">第 {index + 1} 题</p>
                    <h2 className="text-base font-semibold text-gray-900">
                      {question.question}
                    </h2>
                  </div>
                  {isAnswered && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCorrect ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      {isCorrect ? '正确' : '错误'}
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = selected === optionIndex;
                    const isRightOption = optionIndex === question.correct_index;
                    const showResult = isAnswered && (isSelected || isRightOption);

                    return (
                      <button
                        key={`${question.id}-${optionIndex}`}
                        type="button"
                        onClick={() => handleSelect(question.id, optionIndex)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-violet-500 bg-violet-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${isAnswered ? 'cursor-default' : ''}`}
                        disabled={isAnswered}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm text-gray-800">{option}</span>
                          {showResult && (
                            <span className={`text-xs font-medium ${isRightOption ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isRightOption ? '正确答案' : '你的选择'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isAnswered && (
                  <div className="mt-4 bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                    <span className="font-medium text-gray-700">解析：</span>
                    {question.explanation || '暂无解析'}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
