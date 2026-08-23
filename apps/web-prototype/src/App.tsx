import { useMemo, useState } from 'react';
import { BottomTabBar, GuestHint, PathTrail, StreakRow } from './components/Chrome';
import { libraryItems, sampleMaterial, type Material } from './data/demo';

type Screen =
  | 'home'
  | 'library'
  | 'import-picker'
  | 'import-paste'
  | 'import-processing'
  | 'import-ready'
  | 'reader'
  | 'original'
  | 'celebration'
  | 'auth';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [material, setMaterial] = useState<Material>(sampleMaterial);
  const [cardIndex, setCardIndex] = useState(2);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [pasteBody, setPasteBody] = useState(
    '深度学习是机器学习的一个分支，它通过构建多层的神经网络来模拟人脑的学习过程。在过去的十年中，随着计算能力的提升和大数据的爆发，深度学习在图像识别、自然语言处理等领域取得了突破性的进展...'
  );
  const [pasteTitle, setPasteTitle] = useState('');
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [isGuest, setIsGuest] = useState(true);

  const card = material.cards[cardIndex];
  const progress = useMemo(
    () => ((cardIndex + 1) / material.cards.length) * 100,
    [cardIndex, material.cards.length]
  );

  const goHome = () => setScreen('home');

  const openCurrentStop = () => {
    setCardIndex(0);
    setScreen('reader');
  };

  const finishCard = () => {
    setXp((v) => v + 5);
    if (cardIndex >= material.cards.length - 1) {
      setStreak((v) => (v === 0 ? 4 : v + 1));
      setXp((v) => v + 20);
      setMaterial((m) => ({
        ...m,
        path: m.path.map((n) => {
          if (n.id === 's2') return { ...n, status: 'done' as const, actionLabel: undefined };
          if (n.id === 's3') return { ...n, status: 'current' as const, actionLabel: '继续' };
          return n;
        }),
      }));
      setScreen('celebration');
      return;
    }
    setCardIndex((i) => i + 1);
  };

  const startImportSplit = () => {
    if (!pasteBody.trim()) return;
    setScreen('import-processing');
    window.setTimeout(() => {
      setGeneratedTitle(pasteTitle.trim() || 'AI 起的标题：深度学习速览');
      setScreen('import-ready');
    }, 1200);
  };

  const goTab = (tab: 'home' | 'import' | 'library') => {
    if (tab === 'home') setScreen('home');
    if (tab === 'library') setScreen('library');
    if (tab === 'import') setScreen(isGuest ? 'auth' : 'import-picker');
  };

  return (
    <div className="phone-shell">
      <div className="phone-scroll flex flex-col">
        {screen === 'home' && (
          <div className="flex min-h-full flex-col justify-between bg-cream">
            <div>
              <StreakRow streak={streak} xp={xp} />
              <div className="px-4 py-3">
                <div className="rounded-2xl border border-line bg-white p-4">
                  <p className="text-xs font-bold uppercase text-teal">当前学习长文</p>
                  <p className="mt-1 text-lg font-bold text-ink">{material.title}</p>
                </div>
              </div>
              <PathTrail nodes={material.path} onContinue={openCurrentStop} />
            </div>
            <div>
              {isGuest && <GuestHint onLogin={() => setScreen('auth')} />}
              <BottomTabBar active="home" onChange={goTab} />
            </div>
          </div>
        )}

        {screen === 'library' && (
          <div className="flex min-h-full flex-col justify-between bg-cream">
            <div>
              <div className="flex items-center justify-between px-4 py-3">
                <h1 className="text-2xl font-bold text-ink">书库</h1>
                <button type="button" onClick={() => setScreen('auth')} className="text-sm font-semibold text-teal">
                  {isGuest ? '登录' : '账户'}
                </button>
              </div>
              <div className="space-y-3 px-4 pb-6">
                {libraryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMaterial(sampleMaterial);
                      setScreen('home');
                    }}
                    className="w-full rounded-2xl border border-line bg-white p-4 text-left shadow-card"
                  >
                    <p className="font-bold text-ink">{item.title}</p>
                    <p className="mt-1 text-sm text-mute">
                      {item.status} · {item.progress}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <BottomTabBar active="library" onChange={goTab} />
          </div>
        )}

        {screen === 'import-picker' && (
          <div className="flex min-h-full flex-col justify-between bg-cream">
            <div>
              <header className="flex items-center gap-3 px-5 pb-5 pt-3">
                <button type="button" onClick={goHome} className="text-xl text-ink" aria-label="返回">
                  ←
                </button>
                <h1 className="text-lg font-bold text-ink">导入文章</h1>
              </header>
              <div className="space-y-3 px-5">
                {[
                  { title: '粘贴文本', desc: '直接贴入文章，自动切分段落', icon: '📋' },
                  { title: '网页链接', desc: '输入公众号或主流文章链接', icon: '🔗' },
                  { title: 'PDF 文件', desc: '支持导入本地 PDF 或 EPUB 书籍', icon: '📄' },
                ].map((row) => (
                  <button
                    key={row.title}
                    type="button"
                    onClick={() => setScreen('import-paste')}
                    className="flex w-full items-center gap-4 rounded-2xl border border-line bg-white p-5 text-left shadow-card"
                  >
                    <div className="flex size-12 items-center justify-center rounded-xl bg-teal-soft text-2xl">
                      {row.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-ink">{row.title}</p>
                      <p className="mt-1 text-[13px] text-mute">{row.desc}</p>
                    </div>
                    <span className="text-faint">›</span>
                  </button>
                ))}
              </div>
            </div>
            <BottomTabBar active="import" onChange={goTab} />
          </div>
        )}

        {screen === 'import-paste' && (
          <div className="flex min-h-full flex-col justify-between bg-cream">
            <div>
              <header className="flex items-center justify-between px-5 py-3">
                <button type="button" onClick={() => setScreen('import-picker')} className="text-xl" aria-label="返回">
                  ←
                </button>
                <h1 className="text-base font-bold text-ink">粘贴文本</h1>
                <div className="size-6" />
              </header>
              <div className="space-y-4 p-5">
                <textarea
                  value={pasteBody}
                  onChange={(e) => setPasteBody(e.target.value)}
                  className="h-80 w-full resize-none rounded-2xl border border-line bg-white p-[18px] font-body text-[15px] leading-relaxed text-ink outline-none focus:border-teal"
                  placeholder="把文章贴在这里"
                />
                <input
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white p-3.5 text-sm text-ink outline-none placeholder:text-faint focus:border-teal"
                  placeholder="标题（可选）· 不填将自动生成"
                />
              </div>
            </div>
            <div className="p-5">
              <button
                type="button"
                onClick={startImportSplit}
                className="w-full rounded-full bg-teal py-3.5 text-base font-bold text-white"
              >
                开始拆分
              </button>
            </div>
          </div>
        )}

        {screen === 'import-processing' && (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-cream px-8 text-center">
            <div className="size-12 animate-pulse rounded-full bg-teal/20" />
            <p className="text-lg font-bold text-ink">正在提炼成关卡…</p>
            <p className="text-sm text-mute">提炼核心要点，并关联原文</p>
            {!pasteTitle.trim() && <p className="text-sm text-mute">正在起一个标题</p>}
          </div>
        )}

        {screen === 'import-ready' && (
          <div className="flex min-h-full flex-col justify-between bg-cream p-5">
            <div className="pt-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-teal text-2xl text-white">
                ✓
              </div>
              <h1 className="text-2xl font-extrabold text-ink">准备好了</h1>
              <p className="mt-3 text-base font-bold text-ink">{generatedTitle}</p>
              <p className="mt-2 text-sm text-mute">共 4 关 · 卡片已关联原文</p>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setMaterial({ ...sampleMaterial, id: 'imported', title: generatedTitle });
                  setIsGuest(false);
                  setCardIndex(0);
                  setScreen('reader');
                }}
                className="w-full rounded-full bg-teal py-4 text-base font-bold text-white"
              >
                开始第 1 关
              </button>
              <button
                type="button"
                onClick={() => {
                  setMaterial({ ...sampleMaterial, id: 'imported', title: generatedTitle });
                  setIsGuest(false);
                  goHome();
                }}
                className="w-full py-2 text-sm font-semibold text-mute"
              >
                稍后再说
              </button>
            </div>
          </div>
        )}

        {screen === 'reader' && card && (
          <div className="flex min-h-full flex-col justify-between bg-[#fafaf8]">
            <div>
              <header className="flex items-center justify-between px-4 py-3">
                <button type="button" onClick={goHome} className="text-xl" aria-label="返回">
                  ←
                </button>
                <div className="text-center">
                  <p className="max-w-[180px] truncate text-sm font-bold text-ink">{material.title}</p>
                  <button
                    type="button"
                    onClick={() => setScreen('original')}
                    className="text-[11px] font-semibold text-teal underline"
                  >
                    原文链接
                  </button>
                </div>
                <div className="size-6" />
              </header>
              <div className="space-y-2 px-5 py-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-teal">{material.stopTitle}</span>
                  <span className="text-mute">
                    {cardIndex + 1} / {material.cards.length} 卡片
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-teal" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="p-5">
                <article className="rounded-[20px] border border-line bg-white p-6 shadow-card">
                  <span className="inline-flex rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-bold uppercase text-teal">
                    {card.label}
                  </span>
                  <div className="mt-4 space-y-3 font-body text-[15px] leading-relaxed text-ink">
                    {card.paragraphs.map((p) => (
                      <p key={p}>
                        {card.highlight && p.includes(card.highlight)
                          ? p.split(card.highlight).map((part, i, arr) => (
                              <span key={`${part}-${i}`}>
                                {part}
                                {i < arr.length - 1 && (
                                  <span className="font-bold text-gold underline">{card.highlight}</span>
                                )}
                              </span>
                            ))
                          : p}
                      </p>
                    ))}
                  </div>
                </article>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 pb-6">
              <button
                type="button"
                disabled={cardIndex === 0}
                onClick={() => setCardIndex((i) => Math.max(0, i - 1))}
                className="rounded-full border border-line px-4 py-3 text-sm font-semibold text-mute disabled:opacity-40"
              >
                ← 上一步
              </button>
              <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold">+5 XP</span>
              <button
                type="button"
                onClick={finishCard}
                className="rounded-full bg-teal px-5 py-3 text-sm font-bold text-white"
              >
                理解了，下一步 →
              </button>
            </div>
          </div>
        )}

        {screen === 'original' && (
          <div className="flex min-h-full flex-col bg-cream">
            <header className="flex items-center justify-between px-4 py-3">
              <button type="button" onClick={() => setScreen('reader')} className="font-semibold text-teal">
                返回卡片
              </button>
              <h1 className="text-sm font-bold text-ink">原文</h1>
              <div className="w-16" />
            </header>
            <div className="space-y-4 px-5 pb-8 font-body text-[15px] leading-relaxed text-ink">
              {material.originalBody.split('\n\n').map((para) => {
                const active = Boolean(card?.originalExcerpt && para.includes(card.originalExcerpt.slice(0, 16)));
                return (
                  <p
                    key={para.slice(0, 24)}
                    className={active ? 'rounded-xl bg-gold-soft/60 p-3 ring-2 ring-gold/40' : undefined}
                  >
                    {para}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {screen === 'celebration' && (
          <div className="flex min-h-full flex-col justify-between bg-teal text-white">
            <div className="flex flex-col items-center pt-20">
              <div className="celebrate-burst flex size-40 items-center justify-center rounded-full bg-white/10 text-6xl">
                🎉
              </div>
              <h1 className="mt-5 text-center text-[28px] font-extrabold">本关完成！</h1>
              <p className="mt-2 text-center text-base text-white/90">你已经掌握了神经元的结构</p>
              <div className="mt-8 w-full px-5">
                <div className="flex items-center justify-between rounded-2xl border border-white/30 bg-white/10 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🔥</span>
                    <div>
                      <p className="font-bold">连续学习 {Math.max(streak, 4)} 天</p>
                      <p className="text-xs text-white/90">明天继续保持！</p>
                    </div>
                  </div>
                  <p className="text-lg font-extrabold">+25 XP</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <button
                type="button"
                onClick={openCurrentStop}
                className="w-full rounded-full bg-white py-4 text-base font-bold text-teal"
              >
                下一关
              </button>
              <button
                type="button"
                onClick={goHome}
                className="w-full rounded-full border-[1.5px] border-white/50 py-3.5 text-[15px] font-bold text-white"
              >
                先到这里
              </button>
              <button type="button" className="w-full py-2 text-[13px] font-semibold text-white/70 underline">
                花 30 秒测验一下本关？
              </button>
            </div>
          </div>
        )}

        {screen === 'auth' && (
          <div className="flex min-h-full flex-col justify-between bg-cream p-5">
            <div>
              <button type="button" onClick={goHome} className="mb-8 text-xl" aria-label="返回">
                ←
              </button>
              <h1 className="text-2xl font-extrabold text-ink">登录后继续</h1>
              <p className="mt-3 text-sm leading-relaxed text-mute">
                登录后可保存临时试学打卡记录、导入自己的长文，并随时同步学习数据。
              </p>
              <div className="mt-8 space-y-3">
                <input
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-teal"
                  placeholder="邮箱"
                  defaultValue="you@example.com"
                />
                <input
                  type="password"
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-teal"
                  placeholder="密码"
                  defaultValue="password"
                />
              </div>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsGuest(false);
                  setScreen('import-picker');
                }}
                className="w-full rounded-full bg-teal py-4 text-base font-bold text-white"
              >
                登录
              </button>
              <button type="button" onClick={goHome} className="w-full py-2 text-sm font-semibold text-mute">
                先继续逛逛
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
