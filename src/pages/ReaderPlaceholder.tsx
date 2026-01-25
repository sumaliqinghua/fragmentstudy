import { ArrowRight } from 'lucide-react';

interface ReaderPlaceholderProps {
  onBack: () => void;
}

export function ReaderPlaceholder({ onBack }: ReaderPlaceholderProps) {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto px-4 pt-10">
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-800 font-display">阅读模式</h1>
          <p className="text-sm text-slate-400 mt-2">
            选择文章后将进入阅读页，Phase 2 会接入三种阅读模式切换。
          </p>
          <button
            onClick={onBack}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-2xl shadow-[0_4px_0_0_#245aa3] active:translate-y-1"
          >
            去首页选择文章
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
