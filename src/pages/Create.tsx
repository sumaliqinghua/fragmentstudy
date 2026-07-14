import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Link2, Sparkles, UploadCloud } from 'lucide-react';
import { ArticleInput, type InputMode } from '../components/ArticleInput';
import { getArticles, getArticlesCacheSnapshot } from '../services/dataService';
import type { ArticleWithProgress } from '../types';

interface CreateProps {
  onBack?: () => void;
  onSelectArticle?: (id: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function Create({ onBack, onSelectArticle }: CreateProps) {
  const cachedArticles = getArticlesCacheSnapshot();
  const [articles, setArticles] = useState<ArticleWithProgress[]>(cachedArticles || []);
  const [isLoading, setIsLoading] = useState(!cachedArticles);
  const [showInput, setShowInput] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('paste');

  useEffect(() => {
    const loadArticles = async () => {
      setIsLoading(true);
      try {
        const data = await getArticles();
        setArticles(data);
      } catch (error) {
        console.error('Failed to load articles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadArticles();
  }, []);

  const recentArticles = useMemo(() => articles.slice(0, 6), [articles]);

  const openInput = (mode: InputMode) => {
    setInputMode(mode);
    setShowInput(true);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="max-w-md mx-auto">
        <header className="flex items-center p-4 pb-2 justify-between sticky top-0 z-10 bg-white/90 backdrop-blur">
          <button
            onClick={onBack}
            className="text-slate-900 flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-slate-900 text-lg font-bold flex-1 text-center">导入内容</h2>
          <button className="flex w-12 items-center justify-end group">
            <span className="text-primary text-sm font-bold group-hover:opacity-80">帮助</span>
          </button>
        </header>

        <div className="px-4 pb-6 pt-2">
          <h1 className="text-slate-900 tracking-tight text-[30px] font-extrabold leading-[1.15] text-left font-display">
            今天想处理什么内容？
            <span className="text-primary">开始学习</span>
          </h1>
          <p className="text-slate-500 text-base font-medium leading-normal pt-2">
            把你的资料变成可互动的学习路径。
          </p>
        </div>

        <div className="flex flex-col gap-4 px-4">
          <button onClick={() => openInput('paste')} className="group w-full text-left">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 transition-all active:scale-[0.98] hover:border-primary/30 hover:shadow-md">
              <div className="flex flex-col gap-1 flex-[2_2_0px]">
                <p className="text-slate-900 text-lg font-bold leading-tight">粘贴文章</p>
                <p className="text-slate-500 text-sm font-medium leading-normal">复制网页或笔记内容</p>
              </div>
              <div className="size-16 rounded-xl flex items-center justify-center bg-white shrink-0 text-primary shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                <FileText className="w-7 h-7" />
              </div>
            </div>
          </button>

          <button onClick={() => openInput('pdf')} className="group w-full text-left">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 transition-all active:scale-[0.98] hover:border-primary/30 hover:shadow-md">
              <div className="flex flex-col gap-1 flex-[2_2_0px]">
                <p className="text-slate-900 text-lg font-bold leading-tight">上传 PDF</p>
                <p className="text-slate-500 text-sm font-medium leading-normal">扫描或上传文档</p>
              </div>
              <div className="size-16 rounded-xl flex items-center justify-center bg-white shrink-0 text-primary shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-7 h-7" />
              </div>
            </div>
          </button>

          <button onClick={() => openInput('url')} className="group w-full text-left">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 transition-all active:scale-[0.98] hover:border-secondary/30 hover:shadow-md">
              <div className="flex flex-col gap-1 flex-[2_2_0px]">
                <p className="text-slate-900 text-lg font-bold leading-tight">识别网页链接</p>
                <p className="text-slate-500 text-sm font-medium leading-normal">提取文章正文并保留来源</p>
              </div>
              <div className="size-16 rounded-xl flex items-center justify-center bg-white shrink-0 text-secondary shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                <Link2 className="w-7 h-7" />
              </div>
            </div>
          </button>

          <button onClick={() => openInput('ai')} className="group w-full text-left">
            <div className="relative flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 transition-all active:scale-[0.98] hover:border-primary/30 hover:shadow-md">
              <div className="flex flex-col gap-1 flex-[2_2_0px]">
                <div className="flex items-center gap-2">
                  <p className="text-slate-900 text-lg font-bold leading-tight">AI 生成</p>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">New</span>
                </div>
                <p className="text-slate-500 text-sm font-medium leading-normal">通过提示快速生成内容</p>
              </div>
              <div className="size-16 rounded-xl flex items-center justify-center bg-white shrink-0 text-primary shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                <Sparkles className="w-7 h-7" />
              </div>
            </div>
          </button>
        </div>

        <div className="h-8" />

        <div className="flex flex-col px-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 text-lg font-bold leading-tight">最近学习</h3>
            <button className="text-primary text-sm font-bold hover:text-primary-dark transition-colors">查看全部</button>
          </div>
          {isLoading ? (
            <div className="py-6 text-sm text-slate-400">加载中...</div>
          ) : recentArticles.length === 0 ? (
            <div className="py-6 text-sm text-slate-400">暂无最近文章</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4">
              {recentArticles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => onSelectArticle?.(article.id)}
                  className="flex-shrink-0 w-40 flex flex-col gap-2 group text-left"
                >
                  <div className="w-full aspect-[4/3] rounded-xl bg-white relative overflow-hidden border border-slate-200 transition-all group-hover:border-primary/50 group-hover:shadow-sm">
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                      <FileText className="w-10 h-10" />
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-900 text-sm font-bold truncate">{article.title}</p>
                    <p className="text-slate-400 text-xs truncate">{formatRelativeTime(article.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-20" />
      </div>

      <ArticleInput
        isOpen={showInput}
        onClose={() => setShowInput(false)}
        onSuccess={() => {
          getArticles().then(setArticles).catch(() => undefined);
        }}
        initialMode={inputMode}
      />
    </div>
  );
}
