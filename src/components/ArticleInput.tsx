import { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { createArticle } from '../services/dataService';

interface ArticleInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'content' | 'processing';

export function ArticleInput({ isOpen, onClose, onSuccess }: ArticleInputProps) {
  const [step, setStep] = useState<Step>('content');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState('');

  const resetForm = () => {
    setStep('content');
    setTitle('');
    setContent('');
    setIsProcessing(false);
    setProcessingStatus('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError('请填写标题和内容');
      return;
    }

    setStep('processing');
    setIsProcessing(true);
    setError('');

    try {
      setProcessingStatus('保存文章...');
      await createArticle(title, content, 'source');
      setProcessingStatus('完成!');
      setTimeout(() => {
        resetForm();
        onSuccess();
        onClose();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败，请重试');
      setIsProcessing(false);
      setStep('content');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">导入文章</h2>
              <p className="text-xs text-gray-500">
                {step === 'content' && '填写内容'}
                {step === 'processing' && '处理中...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); onClose(); }}
            disabled={isProcessing}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {step === 'content' && (
          <>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文章标题
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入文章标题..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文章内容
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="粘贴你想要学习的文章..."
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !content.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-teal-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all"
              >
                导入文章
              </button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="p-10 flex flex-col items-center justify-center flex-1">
            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-lg font-medium text-gray-900 mb-2">{processingStatus}</p>
            <p className="text-sm text-gray-500">请稍候，正在保存...</p>
          </div>
        )}
      </div>
    </div>
  );
}
