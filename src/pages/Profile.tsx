import { useEffect, useMemo, useState } from 'react';
import { Bell, Cpu, Palette, User } from 'lucide-react';
import { getArticles, getTotalPoints } from '../services/dataService';
import { SettingsModal } from '../components/SettingsModal';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../contexts/AuthContext';
import { getStreakDays } from '../utils/streak';
import type { ArticleWithProgress } from '../types';

export function Profile() {
  const { user, isGuest, signOut } = useAuth();
  const [articles, setArticles] = useState<ArticleWithProgress[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [articlesData, points] = await Promise.all([getArticles(), getTotalPoints()]);
        setArticles(articlesData);
        setTotalPoints(points);
      } catch (error) {
        console.error('Failed to load profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const stats = useMemo(() => {
    const articleCount = articles.length;
    const totalCards = articles.reduce((sum, article) => sum + (article.cardCount || 0), 0);
    const totalCompleted = articles.reduce(
      (sum, article) => sum + (article.progress?.completed_count || 0),
      0
    );
    const progressPercent = totalCards > 0 ? Math.round((totalCompleted / totalCards) * 100) : 0;
    const streakDays = getStreakDays();
    return { articleCount, totalCards, totalCompleted, progressPercent, streakDays };
  }, [articles]);

  const handleOpenAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        <header className="mb-6">
          <p className="text-xs text-slate-400">我的</p>
          <h1 className="text-xl font-bold text-slate-800 font-display">个人中心</h1>
        </header>

        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-400">{isGuest ? '访客账号' : '已登录'}</p>
            <p className="text-base font-semibold text-slate-800">
              {user?.email?.split('@')[0] || '学习者'}
            </p>
          </div>
          {isGuest ? (
            <button
              onClick={() => handleOpenAuth('login')}
              className="px-4 py-2 bg-primary text-white rounded-2xl text-sm font-semibold shadow-[0_4px_0_0_#46a302] active:translate-y-1"
            >
              登录
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-2xl text-sm font-semibold"
            >
              退出
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-xs text-slate-400">文章数</p>
            <p className="text-xl font-bold text-slate-800 mt-2">{stats.articleCount}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-xs text-slate-400">总积分</p>
            <p className="text-xl font-bold text-slate-800 mt-2">{totalPoints}</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-xs text-slate-400">最高连胜</p>
            <p className="text-xl font-bold text-slate-800 mt-2">{stats.streakDays} 天</p>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <p className="text-xs text-slate-400">学习进度</p>
            <p className="text-xl font-bold text-slate-800 mt-2">{stats.progressPercent}%</p>
          </div>
        </div>

        <div className="mt-6 bg-white border border-slate-100 rounded-3xl overflow-hidden">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
          >
            <Cpu className="w-5 h-5 text-secondary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">AI 模型</p>
              <p className="text-xs text-slate-400">选择生成模型</p>
            </div>
          </button>
          <div className="border-t border-slate-100" />
          <button className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
            <Palette className="w-5 h-5 text-secondary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">主题</p>
              <p className="text-xs text-slate-400">外观设置</p>
            </div>
          </button>
          <div className="border-t border-slate-100" />
          <button className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors">
            <Bell className="w-5 h-5 text-secondary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">通知</p>
              <p className="text-xs text-slate-400">提醒与提醒频率</p>
            </div>
          </button>
        </div>

        {isGuest && (
          <div className="mt-6 bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-sm text-amber-800 font-medium">注册账号可同步数据</p>
            <button
              onClick={() => handleOpenAuth('register')}
              className="mt-3 w-full py-2 bg-amber-600 text-white rounded-xl text-sm font-semibold"
            >
              立即注册
            </button>
          </div>
        )}

        {isLoading && (
          <p className="mt-4 text-xs text-slate-400">同步中...</p>
        )}
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </div>
  );
}
