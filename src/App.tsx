import { useState, useEffect } from 'react';
import { Home } from './pages/Home';
import { CardReader } from './pages/CardReader';
import { DialogueReader } from './components/DialogueReader';
import { GalgameReader } from './components/GalgameReader';
import { WelcomeModal } from './components/WelcomeModal';
import { AuthModal } from './components/AuthModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getArticle } from './services/dataService';
import type { Article } from './types';

const WELCOME_DISMISSED_KEY = 'welcome_dismissed';

type View = { type: 'home' } | { type: 'reader'; articleId: string };

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
    if (view.type === 'reader') {
      setIsLoading(true);
      getArticle(view.articleId)
        .then(setArticle)
        .finally(() => setIsLoading(false));
    } else {
      setArticle(null);
    }
  }, [view]);

  const handleBack = () => {
    setView({ type: 'home' });
    setArticle(null);
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

    if (article.mode === 'dialogue') {
      return <DialogueReader article={article} onBack={handleBack} />;
    }

    if (article.mode === 'galgame') {
      return <GalgameReader article={article} onBack={handleBack} />;
    }

    return <CardReader articleId={view.articleId} onBack={handleBack} />;
  }

  return (
    <>
      <Home onSelectArticle={(id) => setView({ type: 'reader', articleId: id })} />
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
