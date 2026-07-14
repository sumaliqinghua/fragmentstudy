import { BookOpen, Check, Gift, HelpCircle, Sparkles } from 'lucide-react';
import type { PathNode as PathNodeType } from '../utils/pathGenerator';

interface PathNodeProps {
  node: PathNodeType;
  onClick?: (node: PathNodeType) => void;
}

export function PathNode({ node, onClick }: PathNodeProps) {
  const isInteractive = !!onClick;
  const baseClasses = 'w-16 h-16 rounded-2xl flex items-center justify-center relative';

  const statusClasses =
    node.status === 'seen'
      ? 'bg-primary text-white shadow-[0_6px_0_0_#46a302]'
      : node.status === 'current'
        ? 'bg-primary text-white shadow-[0_8px_0_0_#46a302]'
        : 'bg-white text-secondary border-2 border-secondary/20 shadow-[0_5px_0_0_#dbeafe]';

  const icon = (() => {
    if (node.type === 'card') return <BookOpen className="w-6 h-6" />;
    if (node.type === 'quiz') return <HelpCircle className="w-6 h-6" />;
    return <Gift className="w-6 h-6" />;
  })();

  return (
    <button
      type="button"
      onClick={() => onClick?.(node)}
      disabled={!isInteractive}
      className={`group flex flex-col items-center gap-2 ${!isInteractive ? 'cursor-not-allowed' : ''}`}
    >
      <div className={`${baseClasses} ${statusClasses} ${isInteractive ? 'active:translate-y-1 transition-transform' : ''}`}>
        {node.status === 'current' && (
          <span className="absolute -inset-1 rounded-3xl border-2 border-primary/60 animate-pulse-soft" />
        )}
        {icon}
        {node.status === 'seen' && (
          <span className="absolute -top-2 -right-2 w-6 h-6 bg-white text-primary rounded-full flex items-center justify-center shadow">
            <Check className="w-3.5 h-3.5" />
          </span>
        )}
        {node.status === 'available' && <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-accent fill-accent" />}
      </div>
      {node.status === 'current' && (
        <span className="px-3 py-1 text-[11px] font-bold tracking-wide bg-accent text-slate-900 rounded-full shadow">
          继续看看
        </span>
      )}
      {node.status === 'seen' && (
        <span className="flex items-center gap-1 text-xs text-primary font-semibold">
          <Check className="w-3.5 h-3.5" />
          看过
        </span>
      )}
      {node.status === 'available' && (
        <span className="text-xs text-secondary font-medium">想看就点</span>
      )}
      <span className="text-xs font-semibold text-slate-700">{node.label}</span>
    </button>
  );
}
