import { useState, useEffect } from 'react';
import { Plus, Settings, Coins, BookOpen, User, LogOut, ChevronDown, AlertCircle } from 'lucide-react';
import { getArticles, deleteArticle, getTotalPoints } from '../services/dataService';
import { ArticleList } from '../components/ArticleList';
import { ArticleInput } from '../components/ArticleInput';
import { SettingsModal } from '../components/SettingsModal';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../contexts/AuthContext';
import type { ArticleWithProgress } from '../types';

interface HomeProps {
  onSelectArticle: (id: string) => void;
}

export function Home({ onSelectArticle }: HomeProps) {
  const { user, isGuest, signOut } = useAuth();
  const [articles, setArticles] = useState<ArticleWithProgress[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [articlesData, points] = await Promise.all([
        getArticles(),
        getTotalPoints(),
      ]);
      setArticles(articlesData);
      setTotalPoints(points);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这篇文章吗？')) return;

    try {
      await deleteArticle(id);
      setArticles(prev => prev.filter(a => a.id !== id));
    } catch (error) {
      console.error('Failed to delete article:', error);
    }
  };

  const handleOpenLogin = () => {
    setAuthModalMode('login');
    setShowAuthModal(true);
  };

  const handleOpenRegister = () => {
    setAuthModalMode('register');
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    await signOut();
    setShowUserMenu(false);
    loadData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">卡片学习</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-700">{totalPoints}</span>
            </div>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>

            {isGuest ? (
              <button
                onClick={handleOpenLogin}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
              >
                <User className="w-4 h-4" />
                登录
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  <div className="w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
                    {user?.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500">已登录为</p>
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user?.email}
                        </p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {isGuest && (
        <div className="bg-amber-50 border-b border-amber-100">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                您当前以访客身份使用，数据仅保存在本地
              </p>
            </div>
            <button
              onClick={handleOpenRegister}
              className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              注册保存
            </button>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">我的文章</h2>
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-medium hover:from-teal-700 hover:to-emerald-700 transition-all shadow-lg shadow-teal-500/20"
          >
            <Plus className="w-5 h-5" />
            导入文章
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-500">加载中...</p>
          </div>
        ) : (
          <ArticleList
            articles={articles}
            onSelect={onSelectArticle}
            onDelete={handleDelete}
          />
        )}
      </main>

      <ArticleInput
        isOpen={showInput}
        onClose={() => setShowInput(false)}
        onSuccess={loadData}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
