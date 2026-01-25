import { BookOpen, Home, PlusCircle, User } from 'lucide-react';
import type { ReactNode } from 'react';

export type TabKey = 'home' | 'create' | 'reader' | 'profile';

const tabs: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  { key: 'home', label: '首页', icon: <Home className="w-5 h-5" /> },
  { key: 'create', label: '新建', icon: <PlusCircle className="w-5 h-5" /> },
  { key: 'reader', label: '阅读', icon: <BookOpen className="w-5 h-5" /> },
  { key: 'profile', label: '我的', icon: <User className="w-5 h-5" /> },
];

interface BottomTabBarProps {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}

export function BottomTabBar({ activeTab, onChange }: BottomTabBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-100">
      <div className="max-w-md mx-auto px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 gap-2 py-2">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-2xl border text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
