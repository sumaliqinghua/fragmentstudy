type TabKey = 'home' | 'import' | 'library';

interface BottomTabBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

function IconHome({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-6 ${active ? 'text-teal' : 'text-faint'}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function IconBook({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-6 ${active ? 'text-teal' : 'text-faint'}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2V5Z" />
      <path d="M17 3v16a2 2 0 0 1-2 2H6" />
    </svg>
  );
}

export function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <div className="shrink-0 border-t border-line bg-white">
      <div className="flex h-16 items-center justify-between px-4">
        <button type="button" onClick={() => onChange('home')} className="flex w-20 flex-col items-center gap-1">
          <IconHome active={active === 'home'} />
          <span className={`text-[10px] font-semibold ${active === 'home' ? 'text-teal' : 'text-faint'}`}>首页</span>
        </button>

        <button
          type="button"
          aria-label="导入"
          onClick={() => onChange('import')}
          className="flex size-[52px] items-center justify-center rounded-[26px] bg-teal text-2xl font-light text-white"
        >
          +
        </button>

        <button type="button" onClick={() => onChange('library')} className="flex w-20 flex-col items-center gap-1">
          <IconBook active={active === 'library'} />
          <span className={`text-[10px] font-semibold ${active === 'library' ? 'text-teal' : 'text-faint'}`}>书库</span>
        </button>
      </div>
      <div className="flex h-5 items-center justify-center">
        <div className="h-[5px] w-[134px] rounded-full bg-ink/30" />
      </div>
    </div>
  );
}

export function StreakRow({ streak, xp }: { streak: number; xp: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-1.5">
        <div className="size-7 rounded-lg bg-teal" />
        <span className="text-base font-bold text-ink">FragmentStudy</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1.5">
          <span className="text-sm">🔥</span>
          <span className="text-[13px] font-bold text-mute">连续 {streak} 天</span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-gold-soft px-2.5 py-1.5">
          <span className="text-sm">⭐</span>
          <span className="text-[13px] font-bold text-gold">{xp} XP</span>
        </div>
      </div>
    </div>
  );
}

export function PathTrail({
  nodes,
  onContinue,
}: {
  nodes: import('../data/demo').PathNode[];
  onContinue?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 pb-6 pt-4">
      {nodes.map((node, index) => {
        const next = nodes[index + 1];
        const lineSolid = node.status === 'done';
        const afterCurrent = node.status === 'current';

        return (
          <div key={node.id} className="flex w-full flex-col items-center">
            {node.kind === 'chest' ? (
              <div className="flex flex-col items-center py-2">
                <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-line bg-white text-3xl">
                  🎁
                </div>
                <p className="mt-1 text-[11px] font-semibold uppercase text-mute">{node.label}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div
                  className={
                    node.status === 'current'
                      ? 'flex size-[72px] items-center justify-center rounded-full border-[6px] border-teal bg-teal text-xl font-bold text-white shadow-node'
                      : node.status === 'done'
                        ? 'flex size-14 items-center justify-center rounded-full border-4 border-teal bg-teal text-xl text-white'
                        : 'flex size-14 items-center justify-center rounded-full border-4 border-line bg-white text-base font-bold text-faint'
                  }
                >
                  {node.status === 'done' ? '✓' : node.number}
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <p className={`text-[13px] font-bold ${node.status === 'locked' ? 'text-faint' : 'text-ink'}`}>
                    {node.label}
                  </p>
                  {node.status === 'current' && node.actionLabel && (
                    <button
                      type="button"
                      onClick={onContinue}
                      className="rounded-full bg-teal px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {node.actionLabel}
                    </button>
                  )}
                </div>
              </div>
            )}

            {index < nodes.length - 1 && (
              <div
                className={`my-1 h-8 w-0 border-l-2 ${
                  lineSolid ? 'border-solid border-teal' : afterCurrent || next ? 'border-dashed border-line' : 'border-dashed border-line'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function GuestHint({ onLogin }: { onLogin: () => void }) {
  return (
    <button
      type="button"
      onClick={onLogin}
      className="flex w-full items-center justify-center gap-2 bg-teal-soft px-5 py-3.5 text-[13px] font-semibold text-teal"
    >
      <span aria-hidden>?</span>
      导入自己的长文？点击登录同步
    </button>
  );
}
