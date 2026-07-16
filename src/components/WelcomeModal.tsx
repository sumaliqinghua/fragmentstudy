import { BookOpen, User, UserPlus, ArrowRight } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ isOpen, onLogin, onRegister, onSkip }: WelcomeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-teal-600 to-emerald-700 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 p-8 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">欢迎使用卡片学习</h1>
          <p className="text-white/80 text-sm">
            将文章转化为互动卡片，让学习更高效
          </p>
        </div>

        <div className="p-6 space-y-3">
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-teal-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">登录</p>
                <p className="text-xs text-gray-500">已有账号，立即登录</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-teal-600 transition-colors" />
          </button>

          <button
            onClick={onRegister}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">注册</p>
                <p className="text-xs text-gray-500">创建账号，云端同步数据</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-400">或者</span>
            </div>
          </div>

          <button
            onClick={onSkip}
            className="w-full py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            跳过，以访客身份体验
          </button>

          <p className="text-center text-xs text-gray-400 pt-2">
            访客数据仅保留在当前页面，刷新、登录或退出后将清空
          </p>
        </div>
      </div>
    </div>
  );
}
