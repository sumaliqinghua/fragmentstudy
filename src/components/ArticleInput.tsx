import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { X, FileText, Sparkles, UploadCloud } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import { createArticle } from '../services/dataService';
import { generateLearningArticle, isConfigured } from '../services/openai';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.js',
  import.meta.url
).toString();

interface ArticleInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: InputMode;
}

type Step = 'content' | 'processing';
type InputMode = 'paste' | 'pdf' | 'ai';

export function ArticleInput({ isOpen, onClose, onSuccess, initialMode }: ArticleInputProps) {
  const initialModeValue: InputMode = initialMode ?? 'paste';
  const [step, setStep] = useState<Step>('content');
  const [mode, setMode] = useState<InputMode>(initialModeValue);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState('');

  const resetForm = () => {
    setStep('content');
    setMode(initialModeValue);
    setTitle('');
    setContent('');
    setAiPrompt('');
    setIsGenerating(false);
    setIsParsingPdf(false);
    setPdfFileName('');
    setIsProcessing(false);
    setProcessingStatus('');
    setError('');
  };

  useEffect(() => {
    if (isOpen) {
      setMode(initialModeValue);
      setStep('content');
      setError('');
    }
  }, [isOpen, initialModeValue]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请填写标题');
      return;
    }

    if (!content.trim()) {
      setError(mode === 'ai' ? '请先生成内容' : '请填写内容');
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

  const extractPdfText = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: buffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += `${pageText}\n\n`;
    }
    return fullText.trim();
  };

  const handlePdfFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('请选择 PDF 文件');
      return;
    }
    setError('');
    setIsParsingPdf(true);
    setPdfFileName(file.name);
    try {
      const text = await extractPdfText(file);
      if (!text) {
        setError('未能解析 PDF 文本，请尝试其他文件');
        return;
      }
      setContent(text);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.pdf$/i, ''));
      }
    } catch (err) {
      console.error('Failed to parse PDF:', err);
      setError('解析 PDF 失败，请重试');
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError('请输入问题或内容');
      return;
    }
    if (!isConfigured()) {
      setError('请先配置 API Key');
      return;
    }
    setError('');
    setIsGenerating(true);
    try {
      const result = await generateLearningArticle(aiPrompt.trim());
      if (!title.trim() && result.title) {
        setTitle(result.title);
      }
      setContent(result.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handlePdfFile(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40" onClick={() => { resetForm(); onClose(); }} />
      <div className="relative mt-auto bg-white rounded-t-3xl w-full max-w-md mx-auto shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">新增内容</h2>
              <p className="text-xs text-gray-500">
                {step === 'content' && '选择一种形式生成文章'}
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
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                {([
                  { id: 'paste', label: '粘贴文本' },
                  { id: 'pdf', label: '拖拽PDF' },
                  { id: 'ai', label: 'AI生成' },
                ] as { id: InputMode; label: string }[]).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMode(item.id);
                      setError('');
                    }}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      mode === item.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文章标题
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入内容标题..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
              </div>

              {mode === 'paste' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    文章内容
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="粘贴你想要学习的文本..."
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                  />
                </div>
              )}

              {mode === 'pdf' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    PDF 文件
                  </label>
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                      isParsingPdf ? 'border-teal-300 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <UploadCloud className="w-10 h-10 text-teal-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      拖拽 PDF 到这里，或点击上传
                    </p>
                    <label className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg cursor-pointer hover:bg-teal-700 transition-colors">
                      选择文件
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) {
                            return;
                          }
                          handlePdfFile(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    {pdfFileName && (
                      <p className="text-xs text-gray-500 mt-2">
                        已选择：{pdfFileName}
                      </p>
                    )}
                    {isParsingPdf && (
                      <p className="text-xs text-teal-600 mt-2">正在解析 PDF...</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      解析内容
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="解析完成后会显示在这里，可继续编辑"
                      rows={10}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </div>
              )}

              {mode === 'ai' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      问题或内容描述
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="例如：用通俗语言讲解贝叶斯定理，并给出应用场景..."
                      rows={6}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-medium hover:from-teal-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isGenerating ? '生成中...' : '生成学习文章'}
                  </button>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      生成内容
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="生成完成后会显示在这里，可继续编辑"
                      rows={10}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={
                  !title.trim()
                  || !content.trim()
                  || isProcessing
                  || isGenerating
                  || isParsingPdf
                }
                className="w-full py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-teal-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed transition-all"
              >
                新增内容
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
