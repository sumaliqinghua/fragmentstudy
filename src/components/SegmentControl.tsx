import type { ReactNode } from 'react';

interface SegmentTab {
  key: string;
  label: ReactNode;
}

interface SegmentControlProps {
  tabs: SegmentTab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function SegmentControl({ tabs, activeKey, onChange }: SegmentControlProps) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === activeKey)
  );
  const widthPercent = 100 / tabs.length;

  return (
    <div className="relative bg-slate-100 rounded-full p-1 flex items-center">
      <div
        className="absolute top-1 bottom-1 rounded-full bg-white shadow-sm transition-transform"
        style={{
          width: `${widthPercent}%`,
          transform: `translateX(${activeIndex * widthPercent}%)`,
        }}
      />
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative flex-1 px-3 py-2 text-sm font-semibold rounded-full transition-colors ${
            tab.key === activeKey ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
