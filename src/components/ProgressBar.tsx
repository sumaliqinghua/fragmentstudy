import { Gift } from 'lucide-react';

interface ProgressBarProps {
  current: number;
  total: number;
  claimedMilestones: number[];
}

const MILESTONES = [30, 60, 80];

export function ProgressBar({ current, total, claimedMilestones }: ProgressBarProps) {
  const percent = total > 0 ? Math.round(((current + 1) / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-gray-600 font-medium">
          {current + 1} / {total}
        </span>
        <span className="text-teal-600 font-semibold">{percent}%</span>
      </div>

      <div className="relative h-3 bg-gray-200 rounded-full">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />

        {MILESTONES.map((milestone) => {
          const isClaimed = claimedMilestones.includes(milestone);
          const isReached = percent >= milestone;

          return (
            <div
              key={milestone}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${milestone}%` }}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  isClaimed
                    ? 'bg-amber-400 shadow-lg shadow-amber-200'
                    : isReached
                    ? 'bg-amber-500 animate-pulse shadow-lg shadow-amber-200'
                    : 'bg-gray-300'
                }`}
              >
                <Gift className={`w-3.5 h-3.5 ${isClaimed || isReached ? 'text-white' : 'text-gray-500'}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-1 px-1">
        {MILESTONES.map((milestone) => (
          <div
            key={milestone}
            className="text-xs text-gray-400"
            style={{ marginLeft: milestone === 30 ? '26%' : milestone === 60 ? '24%' : '14%' }}
          >
            {milestone}%
          </div>
        ))}
      </div>
    </div>
  );
}
