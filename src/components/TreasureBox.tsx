import { useState } from 'react';
import { Gift, Sparkles, X } from 'lucide-react';

interface TreasureBoxProps {
  isOpen: boolean;
  milestone: number;
  onClaim: () => Promise<number | null>;
  onClose: () => void;
}

export function TreasureBox({ isOpen, milestone, onClaim, onClose }: TreasureBoxProps) {
  const [state, setState] = useState<'closed' | 'opening' | 'opened'>('closed');
  const [points, setPoints] = useState<number | null>(null);

  const handleOpen = async () => {
    setState('opening');
    const earnedPoints = await onClaim();
    setTimeout(() => {
      setPoints(earnedPoints);
      setState('opened');
    }, 800);
  };

  const handleClose = () => {
    setState('closed');
    setPoints(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative">
        {state === 'opened' && (
          <button
            onClick={handleClose}
            className="absolute -top-12 right-0 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        )}

        <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 rounded-3xl p-8 shadow-2xl shadow-amber-500/30 text-center">
          {state === 'closed' && (
            <>
              <div className="w-24 h-24 bg-amber-300 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-inner">
                <Gift className="w-14 h-14 text-amber-700" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                恭喜达成 {milestone}%!
              </h3>
              <p className="text-amber-100 mb-6">
                点击开启你的奖励宝箱
              </p>
              <button
                onClick={handleOpen}
                className="px-8 py-3 bg-white text-amber-600 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                开启宝箱
              </button>
            </>
          )}

          {state === 'opening' && (
            <div className="py-8">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 bg-amber-300 rounded-2xl animate-bounce" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-amber-700 animate-pulse" />
                </div>
              </div>
              <p className="text-xl text-white font-medium animate-pulse">
                开启中...
              </p>
            </div>
          )}

          {state === 'opened' && (
            <>
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-yellow-300 to-amber-400 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
                  <span className="text-4xl font-bold text-amber-800">
                    {points !== null ? `+${points}` : '!'}
                  </span>
                </div>
                <div className="absolute -top-4 -left-4 w-8 h-8 bg-yellow-300 rounded-full animate-ping opacity-75" />
                <div className="absolute -top-2 -right-6 w-6 h-6 bg-amber-300 rounded-full animate-ping opacity-75 animation-delay-200" />
                <div className="absolute -bottom-2 -left-6 w-5 h-5 bg-orange-300 rounded-full animate-ping opacity-75 animation-delay-400" />
              </div>

              {points !== null ? (
                <>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    获得 {points} 积分!
                  </h3>
                  <p className="text-amber-100 mb-6">
                    继续学习，解锁更多奖励
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-white mb-2">
                    已领取过啦
                  </h3>
                  <p className="text-amber-100 mb-6">
                    继续前进，还有更多宝箱等你
                  </p>
                </>
              )}

              <button
                onClick={handleClose}
                className="px-8 py-3 bg-white text-amber-600 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                继续学习
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
