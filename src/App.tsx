import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { ArticleHub } from './pages/ArticleHub';
import { CardReader } from './pages/CardReader';
import { QuizReader } from './pages/QuizReader';
import { WelcomeModal } from './components/WelcomeModal';
import { AuthModal } from './components/AuthModal';
import { BottomTabBar, type TabKey } from './components/BottomTabBar';
import { Create } from './pages/Create';
import { Profile } from './pages/Profile';
import { ReaderPlaceholder } from './pages/ReaderPlaceholder';
import { ReaderPage, type ReaderMode } from './pages/ReaderPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getArticlesCacheSnapshot } from './services/dataService';

const WELCOME_DISMISSED_KEY = 'welcome_dismissed';

type ExtendedReaderMode = ReaderMode | 'card' | 'quiz';
type View =
  | { tab: 'home'; articleId?: string }
  | { tab: 'create' }
  | { tab: 'reader'; articleId?: string; mode?: ExtendedReaderMode }
  | { tab: 'profile' };

function AppContent() {
  const { isLoading: authLoading, isGuest } = useAuth();
  const [view, setView] = useState<View>({ tab: 'home' });
  const [lastArticleId, setLastArticleId] = useState<string | null>(
    getArticlesCacheSnapshot()?.[0]?.id || null
  );
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (!authLoading && isGuest) {
      const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY);
      if (!dismissed) {
        setShowWelcome(true);
      }
    }
  }, [authLoading, isGuest]);

  useEffect(() => {
    if (!lastArticleId) {
      const cached = getArticlesCacheSnapshot();
      if (cached?.[0]?.id) {
        setLastArticleId(cached[0].id);
      }
    }
  }, [lastArticleId]);

  const handleBackToHome = () => {
    setView({ tab: 'home' });
  };

  const handleBackToArticle = () => {
    if (view.tab === 'reader' && view.articleId) {
      setView({ tab: 'home', articleId: view.articleId });
    } else {
      setView({ tab: 'home' });
    }
  };

  const handleWelcomeLogin = () => {
    setShowWelcome(false);
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleWelcomeRegister = () => {
    setShowWelcome(false);
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const handleWelcomeSkip = () => {
    setShowWelcome(false);
    localStorage.setItem(WELCOME_DISMISSED_KEY, 'true');
  };

  const handleTabChange = (tab: TabKey) => {
    if (tab === 'home') {
      setView({ tab: 'home' });
      return;
    }
    if (tab === 'create') {
      setView({ tab: 'create' });
      return;
    }
    if (tab === 'profile') {
      setView({ tab: 'profile' });
      return;
    }
    if (lastArticleId) {
      setView({ tab: 'reader', articleId: lastArticleId, mode: 'original' });
    } else {
      setView({ tab: 'reader' });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (view.tab === 'reader' && view.mode === 'card') {
    return <CardReader articleId={view.articleId!} onBack={handleBackToArticle} />;
  }
  if (view.tab === 'reader' && view.mode === 'quiz') {
    return <QuizReader articleId={view.articleId!} onBack={handleBackToArticle} />;
  }

  if (view.tab === 'home' && view.articleId) {
    return (
      <ArticleHub
        articleId={view.articleId}
        onBack={handleBackToHome}
        onOpenMode={(mode) => {
          setLastArticleId(view.articleId);
          setView({ tab: 'reader', articleId: view.articleId, mode });
        }}
      />
    );
  }

  const activeTab: TabKey = view.tab === 'reader' ? 'reader' : view.tab;

  return (
    <>
      {view.tab === 'home' && (
        <Home
          onSelectArticle={(id) => {
            setLastArticleId(id);
            setView({ tab: 'home', articleId: id });
          }}
          onCreate={() => setView({ tab: 'create' })}
        />
      )}
      {view.tab === 'create' && (
        <Create
          onBack={() => setView({ tab: 'home' })}
          onSelectArticle={(id) => {
            setLastArticleId(id);
            setView({ tab: 'home', articleId: id });
          }}
        />
      )}
      {view.tab === 'profile' && <Profile />}
      {view.tab === 'reader' && view.articleId && view.mode && view.mode !== 'card' && view.mode !== 'quiz' && (
        <ReaderPage
          articleId={view.articleId}
          initialMode={view.mode as ReaderMode}
          onBack={() => setView({ tab: 'home' })}
          onOpenHub={() => setView({ tab: 'home', articleId: view.articleId })}
          onStartQuiz={() => setView({ tab: 'reader', articleId: view.articleId, mode: 'quiz' })}
        />
      )}
      {view.tab === 'reader' && (!view.articleId || !view.mode) && (
        <ReaderPlaceholder onBack={() => setView({ tab: 'home' })} />
      )}
      <BottomTabBar activeTab={activeTab} onChange={handleTabChange} />
      <WelcomeModal
        isOpen={showWelcome}
        onLogin={handleWelcomeLogin}
        onRegister={handleWelcomeRegister}
        onSkip={handleWelcomeSkip}
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authMode}
      />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
