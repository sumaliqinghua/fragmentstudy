import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import type { SourceType } from '../types';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ImportedContent {
  title: string;
  content: string;
  sourceType: SourceType;
  sourceUrl?: string;
  pageCount?: number;
  warnings: string[];
}

export interface ImportProgress {
  stage: 'extracting' | 'ocr' | 'fetching';
  message: string;
  progress: number;
}

type ProgressHandler = (progress: ImportProgress) => void;

const MIN_PAGE_TEXT_LENGTH = 40;
const MAX_BROWSER_OCR_PAGES = 40;
const FALLBACK_WARNING = '已使用备用网页识别服务，请在预览中检查标题和正文';

type ContentImportEnv = {
  DEV?: boolean;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

let contentImportEnvOverride: ContentImportEnv | null = null;

export function setContentImportEnvForTesting(env: ContentImportEnv | null): void {
  contentImportEnvOverride = env;
}

function report(onProgress: ProgressHandler | undefined, progress: ImportProgress): void {
  onProgress?.(progress);
}

function getContentImportEnv(): ContentImportEnv {
  if (contentImportEnvOverride) return contentImportEnvOverride;
  return (import.meta as ImportMeta & { env?: ContentImportEnv }).env ?? {};
}

async function extractPageText(page: PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  return textContent.items
    .map(item => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1')
    .trim();
}

async function renderPage(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale: 1.7 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('当前浏览器无法创建 PDF 识别画布');
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function recognizeScannedPages(
  pdf: PDFDocumentProxy,
  pageTexts: string[],
  scannedPageIndexes: number[],
  onProgress?: ProgressHandler
): Promise<string[]> {
  if (scannedPageIndexes.length === 0) return pageTexts;
  const pagesToRecognize = scannedPageIndexes.slice(0, MAX_BROWSER_OCR_PAGES);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['chi_sim', 'eng'], undefined, {
    logger: message => {
      if (message.status !== 'recognizing text') return;
      report(onProgress, {
        stage: 'ocr',
        message: '正在识别扫描页面...',
        progress: message.progress,
      });
    },
  });

  try {
    for (let index = 0; index < pagesToRecognize.length; index += 1) {
      const pageIndex = pagesToRecognize[index];
      report(onProgress, {
        stage: 'ocr',
        message: `OCR 识别第 ${pageIndex + 1} 页 (${index + 1}/${pagesToRecognize.length})`,
        progress: index / pagesToRecognize.length,
      });
      const page = await pdf.getPage(pageIndex + 1);
      const canvas = await renderPage(page);
      const result = await worker.recognize(canvas);
      pageTexts[pageIndex] = result.data.text.replace(/\n{3,}/g, '\n\n').trim();
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await worker.terminate();
  }
  return pageTexts;
}

export async function extractPdfContent(
  file: File,
  onProgress?: ProgressHandler
): Promise<ImportedContent> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  const scannedPageIndexes: number[] = [];

  for (let index = 0; index < pdf.numPages; index += 1) {
    report(onProgress, {
      stage: 'extracting',
      message: `正在读取第 ${index + 1}/${pdf.numPages} 页`,
      progress: (index + 1) / pdf.numPages,
    });
    const page = await pdf.getPage(index + 1);
    const text = await extractPageText(page);
    pageTexts.push(text);
    if (text.length < MIN_PAGE_TEXT_LENGTH) scannedPageIndexes.push(index);
  }

  await recognizeScannedPages(pdf, pageTexts, scannedPageIndexes, onProgress);
  const warnings: string[] = [];
  if (scannedPageIndexes.length > MAX_BROWSER_OCR_PAGES) {
    warnings.push(`扫描页超过 ${MAX_BROWSER_OCR_PAGES} 页，仅识别了前 ${MAX_BROWSER_OCR_PAGES} 页`);
  }
  const emptyPages = pageTexts.filter(text => text.length < 10).length;
  if (emptyPages > 0) warnings.push(`${emptyPages} 页未识别到有效文字，请在预览中检查`);

  const content = pageTexts
    .map((text, index) => `【第 ${index + 1} 页】\n${text}`)
    .join('\n\n')
    .trim();
  if (!content || pageTexts.every(text => text.length < 10)) {
    throw new Error('未能从 PDF 中识别出有效文字');
  }

  return {
    title: file.name.replace(/\.pdf$/i, ''),
    content,
    sourceType: 'pdf',
    pageCount: pdf.numPages,
    warnings,
  };
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('仅支持 http 或 https 链接');
  return parsed.toString();
}

function hasSupabaseConfig(env: ContentImportEnv): boolean {
  return Boolean(env.VITE_SUPABASE_URL?.trim() && env.VITE_SUPABASE_ANON_KEY?.trim());
}

function getExtractorUrl(env: ContentImportEnv): string | null {
  if (!hasSupabaseConfig(env)) return null;
  if (env.DEV) return '/content-extractor';
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  return `${supabaseUrl}/functions/v1/content-extractor`;
}

function getExtractorHeaders(
  env: ContentImportEnv,
  accessToken?: string,
): Record<string, string> {
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() || '';
  return {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${accessToken || anonKey}`,
  };
}

async function fetchViaExtractor(
  url: string,
  env: ContentImportEnv,
  accessToken?: string,
): Promise<{ title: string; content: string }> {
  const extractorUrl = getExtractorUrl(env);
  if (!extractorUrl) throw new Error('Supabase 未配置');
  const response = await fetch(extractorUrl, {
    method: 'POST',
    headers: getExtractorHeaders(env, accessToken),
    body: JSON.stringify({ url }),
  });
  const data = await response.json().catch(() => ({})) as { title?: string; content?: string; error?: string };
  if (!response.ok || !data.content) throw new Error(data.error || '网页正文提取失败');
  return { title: data.title || new URL(url).hostname, content: data.content };
}

function normalizeReaderContent(content: string): string {
  return content.replace(/^!Image\s*(\d+)\s*(https?:\/\/\S+)$/gm, '![Image $1]($2)');
}

async function fetchViaReader(url: string): Promise<{ title: string; content: string }> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
  });
  if (!response.ok) throw new Error(`备用正文服务返回 ${response.status}`);
  const content = (await response.text()).trim();
  if (content.length < 80) throw new Error('网页中没有识别到足够的正文');
  const titleMatch = content.match(/^Title:\s*(.+)$/m);
  return {
    title: titleMatch?.[1]?.trim() || new URL(url).hostname,
    content: normalizeReaderContent(content),
  };
}

export async function extractUrlContent(
  value: string,
  onProgress?: ProgressHandler,
  accessToken?: string,
): Promise<ImportedContent> {
  const url = normalizeUrl(value);
  report(onProgress, { stage: 'fetching', message: '正在识别网页正文...', progress: 0.2 });
  let result: { title: string; content: string };
  const warnings: string[] = [];
  const env = getContentImportEnv();
  const extractorUrl = getExtractorUrl(env);
  if (extractorUrl) {
    try {
      result = await fetchViaExtractor(url, env, accessToken);
    } catch {
      report(onProgress, { stage: 'fetching', message: '正在尝试备用识别方式...', progress: 0.6 });
      result = await fetchViaReader(url);
      warnings.push(FALLBACK_WARNING);
    }
  } else {
    result = await fetchViaReader(url);
  }
  report(onProgress, { stage: 'fetching', message: '网页识别完成', progress: 1 });
  return {
    title: result.title,
    content: result.content,
    sourceType: 'url',
    sourceUrl: url,
    warnings,
  };
}
