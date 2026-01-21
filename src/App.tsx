import { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import { ArticleHub } from './pages/ArticleHub';
import { CardReader } from './pages/CardReader';
import { QuizReader } from './pages/QuizReader';
import { DialogueReader } from './components/DialogueReader';
import { GalgameReader } from './components/GalgameReader';
import { WelcomeModal } from './components/WelcomeModal';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getArticle, getArticlesCacheSnapshot } from './services/dataService';
import type { Article } from './types';

const WELCOME_DISMISSED_KEY = 'welcome_dismissed';

type ReaderMode = 'card' | 'dialogue' | 'galgame' | 'quiz';
type View =
  | { type: 'home' }
  | { type: 'article'; articleId: string }
  | { type: 'reader'; articleId: string; mode: ReaderMode };

function AppContent() {
  const { isLoading: authLoading, isGuest } = useAuth();
  const [view, setView] = useState<View>({ type: 'home' });
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
    if (view.type === 'reader' && view.mode !== 'card' && view.mode !== 'quiz') {
      const cachedArticle = getArticlesCacheSnapshot()?.find((item) => item.id === view.articleId) || null;
      if (cachedArticle) {
        setArticle(cachedArticle);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      getArticle(view.articleId)
        .then(setArticle)
        .finally(() => setIsLoading(false));
    } else {
      setArticle(null);
      setIsLoading(false);
    }
  }, [view]);

  const handleBackToHome = () => {
    setView({ type: 'home' });
    setArticle(null);
  };

  const handleBackToArticle = () => {
    if (view.type === 'reader') {
      setView({ type: 'article', articleId: view.articleId });
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

  if (view.type === 'reader') {
    if (view.mode === 'card') {
      return <CardReader articleId={view.articleId} onBack={handleBackToArticle} />;
    }
    if (view.mode === 'quiz') {
      return <QuizReader articleId={view.articleId} onBack={handleBackToArticle} />;
    }

    if (isLoading || !article) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-500">加载中...</p>
          </div>
        </div>
      );
    }

    if (view.mode === 'dialogue') {
      return <DialogueReader article={article} onBack={handleBackToArticle} />;
    }

    return <GalgameReader article={article} onBack={handleBackToArticle} />;
  }

  if (view.type === 'article') {
    return (
      <ArticleHub
        articleId={view.articleId}
        onBack={handleBackToHome}
        onOpenMode={(mode) => setView({ type: 'reader', articleId: view.articleId, mode })}
      />
    );
  }

  return (
    <>
      <Home onSelectArticle={(id) => setView({ type: 'article', articleId: id })} />
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
