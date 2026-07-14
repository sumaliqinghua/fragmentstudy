import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Link2,
  Plus,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  createArticle,
  createSubject,
  ensureTagPaths,
  getSubjects,
  setArticleTags,
} from '../services/dataService';
import { AIResponseParseError, generateLearningArticle, isConfigured } from '../services/openai';
import { extractPdfContent, extractUrlContent, type ImportProgress } from '../services/contentImport';
import type { SourceType, Subject } from '../types';

interface ArticleInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: InputMode;
}

type Step = 'content' | 'review' | 'processing';
export type InputMode = 'paste' | 'pdf' | 'url' | 'ai';

const MODE_SOURCE_TYPE: Record<InputMode, SourceType> = {
  paste: 'text',
  pdf: 'pdf',
  url: 'url',
  ai: 'ai',
};

export function ArticleInput({ isOpen, onClose, onSuccess, initialMode }: ArticleInputProps) {
  const initialModeValue = initialMode ?? 'paste';
  const [step, setStep] = useState<Step>('content');
  const [mode, setMode] = useState<InputMode>(initialModeValue);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<SourceType>(MODE_SOURCE_TYPE[initialModeValue]);
  const [tagInput, setTagInput] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState('');

  const suggestedSubjectId = useMemo(() => {
    const haystack = `${title}\n${content.slice(0, 1200)}`.toLowerCase();
    return subjects.find(subject => haystack.includes(subject.name.toLowerCase()))?.id || '';
  }, [content, subjects, title]);

  const resetForm = () => {
    setStep('content');
    setMode(initialModeValue);
    setTitle('');
    setContent('');
    setAiPrompt('');
    setUrlInput('');
    setSourceUrl(null);
    setSourceType(MODE_SOURCE_TYPE[initialModeValue]);
    setTagInput('');
    setSelectedSubjectId('');
    setNewSubjectName('');
    setWarnings([]);
    setIsGenerating(false);
    setIsImporting(false);
    setPdfFileName('');
    setImportProgress(null);
    setProcessingStatus('');
    setError('');
  };

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialModeValue);
    setSourceType(MODE_SOURCE_TYPE[initialModeValue]);
    setStep('content');
    setError('');
    void getSubjects().then(setSubjects).catch(error => {
      console.warn('Failed to load subjects:', error);
    });
  }, [initialModeValue, isOpen]);

  useEffect(() => {
    if (step === 'review' && !selectedSubjectId && suggestedSubjectId) {
      setSelectedSubjectId(suggestedSubjectId);
    }
  }, [selectedSubjectId, step, suggestedSubjectId]);

  const close = () => {
    resetForm();
    onClose();
  };

  const handleContinue = () => {
    if (!title.trim()) {
      setError('请填写标题');
      return;
    }
    if (!content.trim()) {
      setError(mode === 'url' ? '请先识别网页正文' : mode === 'ai' ? '请先生成内容' : '请填写内容');
      return;
    }
    setError('');
    setStep('review');
  };

  const handleSubmit = async () => {
    setStep('processing');
    setError('');
    try {
      setProcessingStatus('正在保存资料...');
      const article = await createArticle(title.trim(), content.trim(), 'source', undefined, {
        subjectId: selectedSubjectId || null,
        sourceType,
        sourceUrl,
      });
      const tagPaths = tagInput.split(/[，,]/).map(item => item.trim()).filter(Boolean);
      if (tagPaths.length > 0) {
        setProcessingStatus('正在保存标签...');
        const tagIds = await ensureTagPaths(tagPaths);
        await setArticleTags(article.id, tagIds);
      }
      setProcessingStatus('资料已准备好');
      window.setTimeout(() => {
        resetForm();
        onSuccess();
        onClose();
      }, 400);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败，请重试');
      setStep('review');
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    try {
      const subject = await createSubject(newSubjectName);
      setSubjects(prev => [...prev.filter(item => item.id !== subject.id), subject].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedSubjectId(subject.id);
      setNewSubjectName('');
    } catch (subjectError) {
      setError(subjectError instanceof Error ? subjectError.message : '创建科目失败');
    }
  };

  const handlePdfFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('请选择 PDF 文件');
      return;
    }
    setError('');
    setWarnings([]);
    setIsImporting(true);
    setPdfFileName(file.name);
    try {
      const result = await extractPdfContent(file, setImportProgress);
      setContent(result.content);
      setSourceType(result.sourceType);
      setSourceUrl(null);
      setWarnings(result.warnings);
      if (!title.trim()) setTitle(result.title);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'PDF 识别失败，请重试');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) {
      setError('请输入网页链接');
      return;
    }
    setError('');
    setWarnings([]);
    setIsImporting(true);
    try {
      const result = await extractUrlContent(urlInput, setImportProgress);
      setTitle(result.title);
      setContent(result.content);
      setSourceType(result.sourceType);
      setSourceUrl(result.sourceUrl || urlInput.trim());
      setWarnings(result.warnings);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '网页识别失败，请重试');
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError('请输入问题或内容描述');
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
      setContent(result);
      setSourceType('ai');
      setSourceUrl(null);
    } catch (generateError) {
      if (generateError instanceof AIResponseParseError && generateError.rawText) {
        setContent(generateError.rawText);
      }
      setError(generateError instanceof Error ? generateError.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void handlePdfFile(file);
  };

  if (!isOpen) return null;

  const isBusy = isGenerating || isImporting;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col">
      <button className="absolute inset-0 bg-black/40" onClick={close} aria-label="关闭导入" />
      <div className="relative mt-auto mb-24 bg-white rounded-t-3xl w-full max-w-md mx-auto shadow-2xl max-h-[calc(100vh-120px)] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {step === 'review' && (
              <button onClick={() => setStep('content')} className="p-2 -ml-2 rounded-full hover:bg-slate-100" aria-label="返回编辑">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {step === 'content' ? '导入学习资料' : step === 'review' ? '确认识别结果' : '正在准备资料'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {step === 'content' ? '识别后先预览，不会直接生成学习内容' : step === 'review' ? '可以修正正文并选择科目' : processingStatus}
              </p>
            </div>
          </div>
          <button onClick={close} disabled={step === 'processing'} className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-40" aria-label="关闭">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {step === 'content' && (
          <>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl">
                {([
                  { id: 'paste', label: '文本' },
                  { id: 'pdf', label: 'PDF' },
                  { id: 'url', label: '链接' },
                  { id: 'ai', label: 'AI' },
                ] as { id: InputMode; label: string }[]).map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMode(item.id);
                      setSourceType(MODE_SOURCE_TYPE[item.id]);
                      if (item.id !== 'url') setSourceUrl(null);
                      setError('');
                    }}
                    className={`px-2 py-2 text-sm font-medium rounded-lg transition-colors ${
                      mode === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-2">资料标题</span>
                <input value={title} onChange={event => setTitle(event.target.value)} placeholder="输入资料标题" className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none" />
              </label>

              {mode === 'paste' && (
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-2">资料内容</span>
                  <textarea value={content} onChange={event => setContent(event.target.value)} rows={12} placeholder="粘贴想要学习的内容..." className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none" />
                </label>
              )}

              {mode === 'pdf' && (
                <div className="space-y-3">
                  <div onDragOver={event => event.preventDefault()} onDrop={handleDrop} className={`border-2 border-dashed rounded-2xl p-6 text-center ${isImporting ? 'border-primary bg-primary/5' : 'border-slate-200'}`}>
                    <UploadCloud className="w-9 h-9 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">上传文本或扫描版 PDF</p>
                    <p className="text-xs text-slate-400 mt-1">扫描页会自动启动中英文 OCR</p>
                    <label className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl cursor-pointer">
                      选择 PDF
                      <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) void handlePdfFile(file);
                        event.currentTarget.value = '';
                      }} />
                    </label>
                    {pdfFileName && <p className="text-xs text-slate-500 mt-3 truncate">{pdfFileName}</p>}
                  </div>
                  {content && <textarea value={content} onChange={event => setContent(event.target.value)} rows={8} className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none" aria-label="PDF 识别内容" />}
                </div>
              )}

              {mode === 'url' && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700 mb-2">网页链接</span>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                        <input value={urlInput} onChange={event => setUrlInput(event.target.value)} placeholder="https://..." className="w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl outline-none focus:border-secondary" />
                      </div>
                      <button onClick={() => void handleUrlImport()} disabled={isImporting || !urlInput.trim()} className="px-4 bg-secondary text-white rounded-xl font-semibold disabled:bg-slate-300">识别</button>
                    </div>
                  </label>
                  {content && <textarea value={content} onChange={event => setContent(event.target.value)} rows={10} className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none" aria-label="网页识别内容" />}
                </div>
              )}

              {mode === 'ai' && (
                <div className="space-y-3">
                  <textarea value={aiPrompt} onChange={event => setAiPrompt(event.target.value)} rows={5} placeholder="例如：用通俗语言解释贝叶斯定理，并给出生活中的例子" className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none" />
                  <button onClick={() => void handleGenerate()} disabled={isGenerating || !aiPrompt.trim()} className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary text-white rounded-xl font-semibold disabled:bg-slate-300">
                    <Sparkles className="w-4 h-4" />
                    {isGenerating ? '生成中...' : '生成资料'}
                  </button>
                  {content && <textarea value={content} onChange={event => setContent(event.target.value)} rows={8} className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none" aria-label="AI 生成内容" />}
                </div>
              )}

              {importProgress && (
                <div className="p-3 bg-secondary/5 border border-secondary/10 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-secondary">
                    <span>{importProgress.message}</span><span>{Math.round(importProgress.progress * 100)}%</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden"><div className="h-full bg-secondary" style={{ width: `${importProgress.progress * 100}%` }} /></div>
                </div>
              )}
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
            </div>
            <div className="p-5 border-t border-slate-100">
              <button onClick={handleContinue} disabled={isBusy || !title.trim() || !content.trim()} className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold shadow-[0_4px_0_0_#46a302] disabled:bg-slate-300 disabled:shadow-none">预览并继续</button>
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div><p className="text-sm font-semibold text-slate-800">识别完成，可以开始整理</p><p className="text-xs text-slate-500 mt-1">约 {Math.max(1, Math.ceil(content.length / 160))} 个学习片段，生成后仍可切换学习方式。</p></div>
              </div>
              {warnings.map(warning => <div key={warning} className="flex gap-2 p-3 bg-amber-50 text-amber-800 rounded-xl text-sm"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{warning}</div>)}

              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-2">标题</span>
                <input value={title} onChange={event => setTitle(event.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-2">主科目</span>
                <select value={selectedSubjectId} onChange={event => setSelectedSubjectId(event.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl">
                  <option value="">未分类</option>
                  {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
                {suggestedSubjectId && <p className="text-xs text-primary mt-2">已根据内容匹配现有科目</p>}
              </label>
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">新建科目</span>
                <div className="flex gap-2">
                  <input value={newSubjectName} onChange={event => setNewSubjectName(event.target.value)} placeholder="例如：经济学" className="flex-1 min-w-0 px-4 py-3 border border-slate-200 rounded-xl" />
                  <button onClick={() => void handleCreateSubject()} disabled={!newSubjectName.trim()} className="w-12 flex items-center justify-center bg-slate-100 text-slate-700 rounded-xl disabled:opacity-40" aria-label="新建科目"><Plus className="w-5 h-5" /></button>
                </div>
              </div>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-2">标签（可选）</span>
                <input value={tagInput} onChange={event => setTagInput(event.target.value)} placeholder="多个标签用逗号分隔" className="w-full px-4 py-3 border border-slate-200 rounded-xl" />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-2">识别正文</span>
                <textarea value={content} onChange={event => setContent(event.target.value)} rows={12} className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none" />
              </label>
              {sourceUrl && <p className="text-xs text-slate-400 break-all">来源：{sourceUrl}</p>}
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
            </div>
            <div className="p-5 border-t border-slate-100">
              <button onClick={() => void handleSubmit()} className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold shadow-[0_4px_0_0_#46a302]">加入资料库</button>
            </div>
          </>
        )}

        {step === 'processing' && (
          <div className="p-12 flex flex-col items-center justify-center min-h-72">
            <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mb-5" />
            <p className="text-base font-semibold text-slate-900">{processingStatus}</p>
            <p className="text-sm text-slate-500 mt-2">马上就能开始看第一个片段</p>
          </div>
        )}
      </div>
    </div>
  );
}
