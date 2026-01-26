import { useMemo, useState } from 'react';
import { BookOpen, Sparkles, Volume2 } from 'lucide-react';
import type { Article } from '../types';

interface OriginalReaderProps {
  article: Article;
  onStartQuiz?: () => void;
}

export function OriginalReader({ article, onStartQuiz }: OriginalReaderProps) {
  const [activeWord, setActiveWord] = useState<string | null>(null);

  const paragraphs = useMemo(() => {
    return article.original_content
      .split(/\n\n+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }, [article.original_content]);

  return (
    <div className="px-6 pb-24 max-w-md mx-auto">
      <div className="mb-8">
        <div className="w-full h-52 rounded-2xl overflow-hidden mb-6 shadow-sm border border-slate-100 bg-gradient-to-br from-slate-100 via-white to-slate-200 flex items-center justify-center">
          <BookOpen className="w-16 h-16 text-slate-300" />
        </div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 mb-4 font-display">
          {article.title}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex h-7 items-center justify-center gap-x-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <p className="text-emerald-700 text-[11px] font-bold uppercase tracking-wider">Intermediate</p>
          </div>
          <div className="flex h-7 items-center justify-center gap-x-1.5 rounded-full bg-slate-50 border border-slate-200 px-3">
            <BookOpen className="w-4 h-4 text-slate-500" />
            <p className="text-slate-600 text-[11px] font-bold uppercase tracking-wider">5 min read</p>
          </div>
        </div>
      </div>

      <article className="space-y-6">
        {paragraphs.map((paragraph, index) => {
          const isHighlighted = activeWord && paragraph.includes(activeWord);
          const chunks = paragraph.split(/(\s+)/);
          return (
            <p
              key={`${index}-${paragraph.slice(0, 20)}`}
              className={`text-[20px] leading-[1.8] text-slate-700 ${isHighlighted ? 'highlight-sentence' : ''}`}
            >
              {chunks.map((chunk, chunkIndex) => {
                if (/\s+/.test(chunk)) return <span key={`${index}-space-${chunkIndex}`}>{chunk}</span>;
                const isActive = chunk === activeWord;
                return (
                  <span
                    key={`${index}-word-${chunkIndex}`}
                    className={isActive ? 'active-word' : 'interactive-word'}
                    onClick={() => setActiveWord(chunk)}
                  >
                    {chunk}
                  </span>
                );
              })}
            </p>
          );
        })}

        <div className="mt-12 mb-8 p-6 rounded-2xl bg-slate-50 border-2 border-slate-100">
          <h3 className="text-xl font-bold text-slate-900 mb-2">Comprehension Check</h3>
          <p className="text-slate-500 mb-6">Test your understanding of the material.</p>
          <button
            onClick={onStartQuiz}
            className="w-full bg-primary text-white font-bold py-4 px-6 rounded-xl shadow-[0_4px_0_0_#46a302] active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            Start Quiz
          </button>
        </div>
      </article>

      {activeWord && (
        <div className="fixed inset-0 z-40 flex items-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setActiveWord(null)} />
          <div className="relative w-full max-w-md mx-auto bg-white rounded-t-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden border border-slate-100">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">{activeWord}</h2>
                  <span className="text-primary font-bold text-xs uppercase tracking-widest">Vocabulary</span>
                </div>
                <button className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-slate-900 text-base leading-snug">
                    这里将展示单词释义和例句。
                  </p>
                  <p className="mt-3 text-slate-500 text-sm italic border-t border-slate-200 pt-3">
                    "Add a sample sentence here."
                  </p>
                </div>
                <button
                  onClick={() => setActiveWord(null)}
                  className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-[0_4px_0_0_#46a302] active:translate-y-1"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
