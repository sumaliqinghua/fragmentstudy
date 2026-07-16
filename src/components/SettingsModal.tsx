import { useState, useEffect } from 'react';
import { X, Save, Cpu } from 'lucide-react';
import { getOpenAIConfig, saveOpenAIConfig } from '../services/openai';
import { ALLOWED_AI_MODELS } from '../services/aiConfig';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [model, setModel] = useState('');
  const [saved, setSaved] = useState(false);
  const availableModels =
    model && !ALLOWED_AI_MODELS.some(option => option === model)
      ? [model, ...ALLOWED_AI_MODELS]
      : ALLOWED_AI_MODELS;

  useEffect(() => {
    if (isOpen) {
      const config = getOpenAIConfig();
      setModel(config.model);
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    saveOpenAIConfig({ model });
    setSaved(true);
    setTimeout(() => onClose(), 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">AI 模型</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Cpu className="w-4 h-4" />
              模型
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm bg-white"
            >
              {availableModels.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={!model}
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {saved ? (
              <>已保存</>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存设置
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
