import { Flame, X } from 'lucide-react';

interface StreakModalProps {
  isOpen: boolean;
  streakDays: number;
  onClose: () => void;
}

const DAYS = Array.from({ length: 7 }, (_, i) => i + 1);

export function StreakModal({ isOpen, streakDays, onClose }: StreakModalProps) {
  if (!isOpen) return null;

  const activeDays = Math.min(7, Math.max(0, streakDays));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-sm">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        <div className="bg-gradient-to-br from-orange-400 via-amber-500 to-rose-500 rounded-3xl p-8 shadow-2xl shadow-orange-500/30 text-center text-white">
          <div className="w-20 h-20 rounded-2xl bg-white/15 mx-auto mb-4 flex items-center justify-center shadow-inner">
            <Flame className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-2">连胜 {streakDays} 天</h3>
          <p className="text-sm text-white/80 mb-6">保持节奏，完成今天的学习目标</p>

          <div className="grid grid-cols-7 gap-2 mb-6">
            {DAYS.map((day) => {
              const isActive = day <= activeDays;
              return (
                <div
                  key={`streak-day-${day}`}
                  className={`h-10 rounded-xl flex items-center justify-center text-xs font-bold border ${
                    isActive
                      ? 'bg-white text-orange-500 border-white/80 shadow-[0_4px_0_0_rgba(255,255,255,0.4)]'
                      : 'bg-white/10 text-white/60 border-white/20'
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-white text-orange-500 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
          >
            继续学习
          </button>
        </div>
      </div>
    </div>
  );
}
