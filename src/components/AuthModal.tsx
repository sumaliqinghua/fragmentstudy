import { useState } from 'react';
import { X, Mail, Lock, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'reset';
}

type AuthMode = 'login' | 'register' | 'reset';

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const { configError, emailDeliveryEnabled, signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>(
    initialMode === 'reset' && !emailDeliveryEnabled ? 'login' : initialMode,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [registrationSent, setRegistrationSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message === 'Invalid login credentials'
            ? '邮箱或密码错误'
            : error.message);
        } else {
          onClose();
        }
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('密码至少需要6位');
          setIsLoading(false);
          return;
        }
        const { error, requiresEmailConfirmation } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('该邮箱已被注册');
          } else {
            setError(error.message);
          }
        } else if (requiresEmailConfirmation) {
          setRegistrationSent(true);
        } else {
          onClose();
        }
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message);
        } else {
          setResetSent(true);
        }
      }
    } catch {
      setError('操作失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode === 'reset' && !emailDeliveryEnabled ? 'login' : newMode);
    setError('');
    setResetSent(false);
    setRegistrationSent(false);
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return '登录';
      case 'register': return '注册';
      case 'reset': return '重置密码';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {mode === 'reset' && (
              <button
                onClick={() => switchMode('login')}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900">{getTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {mode === 'register' && registrationSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">确认邮件已发送</h3>
              <p className="text-gray-600 text-sm">
                请查收邮箱并完成确认，然后返回登录
              </p>
              <button
                onClick={() => switchMode('login')}
                className="mt-6 text-teal-600 hover:text-teal-700 font-medium"
              >
                返回登录
              </button>
            </div>
          ) : mode === 'reset' && resetSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">邮件已发送</h3>
              <p className="text-gray-600 text-sm">
                请查收您的邮箱，点击邮件中的链接重置密码
              </p>
              <button
                onClick={() => switchMode('login')}
                className="mt-6 text-teal-600 hover:text-teal-700 font-medium"
              >
                返回登录
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="至少6位"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    确认密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="再次输入密码"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              )}

              {(error || configError) && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">
                  {error || configError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || Boolean(configError)}
                className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-medium hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                {mode === 'login' && '登录'}
                {mode === 'register' && '注册'}
                {mode === 'reset' && '发送重置邮件'}
              </button>

              {mode === 'login' && emailDeliveryEnabled && (
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
                >
                  忘记密码？
                </button>
              )}
            </form>
          )}

          {mode !== 'reset' && (
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              {mode === 'login' ? (
                <p className="text-gray-600 text-sm">
                  还没有账号？
                  <button
                    onClick={() => switchMode('register')}
                    className="text-teal-600 hover:text-teal-700 font-medium ml-1"
                  >
                    立即注册
                  </button>
                </p>
              ) : (
                <p className="text-gray-600 text-sm">
                  已有账号？
                  <button
                    onClick={() => switchMode('login')}
                    className="text-teal-600 hover:text-teal-700 font-medium ml-1"
                  >
                    立即登录
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
