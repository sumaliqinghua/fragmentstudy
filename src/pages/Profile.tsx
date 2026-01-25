export function Profile() {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        <header className="mb-6">
          <p className="text-xs text-slate-400">我的</p>
          <h1 className="text-xl font-bold text-slate-800 font-display">个人中心</h1>
        </header>
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <p className="text-base font-semibold text-slate-700">Phase 2 将补齐个人中心</p>
          <p className="text-sm text-slate-400 mt-2">统计与设置将在后续阶段完成。</p>
        </div>
      </div>
    </div>
  );
}
