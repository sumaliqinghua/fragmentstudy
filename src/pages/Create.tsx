import { ArrowLeft } from 'lucide-react';

interface CreateProps {
  onBack?: () => void;
}

export function Create({ onBack }: CreateProps) {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        <header className="flex items-center gap-3 mb-6">
          {onBack && (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div>
            <p className="text-xs text-slate-400">新建</p>
            <h1 className="text-xl font-bold text-slate-800 font-display">准备导入内容</h1>
          </div>
        </header>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <p className="text-base font-semibold text-slate-700">Phase 2 将上线导入入口</p>
          <p className="text-sm text-slate-400 mt-2">
            目前可先在首页查看学习路径，导入页将在下一阶段完成。
          </p>
        </div>
      </div>
    </div>
  );
}
