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
  const [lastArticleHubId, setLastArticleHubId] = useState<string | null>(null);
  const [lastReader, setLastReader] = useState<{ articleId?: string; mode?: ExtendedReaderMode }>({});
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [mountedViews, setMountedViews] = useState({
    home: true,
    create: false,
    profile: false,
    articleHub: false,
    reader: false,
    card: false,
    quiz: false,
    readerPlaceholder: false,
  });

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

  useEffect(() => {
    if (view.tab === 'home' && view.articleId) {
      setLastArticleHubId(view.articleId);
    }
    if (view.tab === 'reader' && view.articleId) {
      setLastReader({ articleId: view.articleId, mode: view.mode });
    }
    setMountedViews((prev) => ({
      ...prev,
      home: prev.home || view.tab === 'home',
      create: prev.create || view.tab === 'create',
      profile: prev.profile || view.tab === 'profile',
      articleHub: prev.articleHub || (view.tab === 'home' && !!view.articleId),
      reader: prev.reader || (view.tab === 'reader' && view.mode !== 'card' && view.mode !== 'quiz'),
      card: prev.card || (view.tab === 'reader' && view.mode === 'card'),
      quiz: prev.quiz || (view.tab === 'reader' && view.mode === 'quiz'),
      readerPlaceholder: prev.readerPlaceholder || (view.tab === 'reader' && (!view.articleId || !view.mode)),
    }));
  }, [view]);

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
    if (lastReader.articleId) {
      setView({ tab: 'reader', articleId: lastReader.articleId, mode: lastReader.mode || 'original' });
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

  const activeTab: TabKey = view.tab === 'reader' ? 'reader' : view.tab;
  const showHome = view.tab === 'home' && !view.articleId;
  const showArticleHub = view.tab === 'home' && !!view.articleId;
  const showCardReader = view.tab === 'reader' && view.mode === 'card' && !!view.articleId;
  const showQuizReader = view.tab === 'reader' && view.mode === 'quiz' && !!view.articleId;
  const showReader = view.tab === 'reader' && !!view.articleId && view.mode && view.mode !== 'card' && view.mode !== 'quiz';
  const showReaderPlaceholder = view.tab === 'reader' && (!view.articleId || !view.mode);
  const articleHubId = view.tab === 'home' ? view.articleId : lastArticleHubId;
  const readerArticleId = view.tab === 'reader' ? view.articleId : lastReader.articleId;
  const readerMode = view.tab === 'reader' ? view.mode : lastReader.mode;

  return (
    <>
      {mountedViews.home && (
        <div className={showHome ? '' : 'hidden'}>
          <Home
            onSelectArticle={(id) => {
              setLastArticleId(id);
              setView({ tab: 'home', articleId: id });
            }}
            onCreate={() => setView({ tab: 'create' })}
            onCurrentArticleChange={(id) => setLastArticleId(id)}
          />
        </div>
      )}
      {mountedViews.articleHub && articleHubId && (
        <div className={showArticleHub ? '' : 'hidden'}>
          <ArticleHub
            articleId={articleHubId}
            onBack={handleBackToHome}
            onOpenMode={(mode) => {
              setLastArticleId(articleHubId);
              setView({ tab: 'reader', articleId: articleHubId, mode });
            }}
          />
        </div>
      )}
      {mountedViews.create && (
        <div className={view.tab === 'create' ? '' : 'hidden'}>
          <Create
            onBack={() => setView({ tab: 'home' })}
            onSelectArticle={(id) => {
              setLastArticleId(id);
              setView({ tab: 'home', articleId: id });
            }}
          />
        </div>
      )}
      {mountedViews.profile && (
        <div className={view.tab === 'profile' ? '' : 'hidden'}>
          <Profile />
        </div>
      )}
      {mountedViews.reader && readerArticleId && readerMode && readerMode !== 'card' && readerMode !== 'quiz' && (
        <div className={showReader ? '' : 'hidden'}>
          <ReaderPage
            articleId={readerArticleId}
            initialMode={readerMode as ReaderMode}
            onBack={() => setView({ tab: 'home' })}
            onStartQuiz={() => setView({ tab: 'reader', articleId: readerArticleId, mode: 'quiz' })}
          />
        </div>
      )}
      {mountedViews.card && readerArticleId && (
        <div className={showCardReader ? '' : 'hidden'}>
          <CardReader
            articleId={readerArticleId}
            onBack={handleBackToArticle}
            onOpenOriginal={() => setView({ tab: 'reader', articleId: readerArticleId, mode: 'original' })}
          />
        </div>
      )}
      {mountedViews.quiz && readerArticleId && (
        <div className={showQuizReader ? '' : 'hidden'}>
          <QuizReader articleId={readerArticleId} onBack={handleBackToArticle} />
        </div>
      )}
      {mountedViews.readerPlaceholder && (
        <div className={showReaderPlaceholder ? '' : 'hidden'}>
          <ReaderPlaceholder onBack={() => setView({ tab: 'home' })} />
        </div>
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
