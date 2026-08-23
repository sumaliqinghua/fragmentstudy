import { resolveAIAvailability } from './config';
import { isSupabaseConfigured, supabase, supabaseApiUrl } from './supabase';
import type { CardSplitResult } from './types';

const DEFAULT_MODEL = 'qwen/qwen3.7-plus';

export class AIResponseParseError extends Error {
  rawText: string;
  constructor(message: string, rawText: string) {
    super(message);
    this.name = 'AIResponseParseError';
    this.rawText = rawText;
  }
}

export function isAIConfigured(): boolean {
  return resolveAIAvailability(process.env.EXPO_PUBLIC_PLATFORM_AI_ENABLED);
}

function getProxyUrl(): string {
  return `${supabaseApiUrl}/functions/v1/openai-proxy`;
}

async function callOpenAI(
  messages: { role: string; content: string }[],
  stream = false
): Promise<Response> {
  if (!isAIConfigured()) {
    throw new Error('AI 服务暂未配置（EXPO_PUBLIC_PLATFORM_AI_ENABLED）');
  }
  if (!isSupabaseConfigured) {
    throw new Error('请先配置 Supabase 并登录后使用 AI');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('请先登录后使用 AI');
  }

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    messages,
    stream,
    temperature: 0.7,
  };
  if (!stream) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'json_array',
        schema: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
    };
  }

  const response = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string | { message?: string };
    };
    const message = typeof error.error === 'string' ? error.error : error.error?.message;
    throw new Error(message || `API 请求失败: ${response.status}`);
  }

  return response;
}

function parseJsonArray<T>(resultText: string): T[] {
  let cleaned = resultText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new AIResponseParseError('AI 返回格式错误，请重试', cleaned || resultText);
  }
  try {
    return JSON.parse(jsonMatch[0]) as T[];
  } catch {
    throw new AIResponseParseError('AI 返回的 JSON 无法解析', cleaned || resultText);
  }
}

/** Local fallback when AI is unavailable — still usable for logged-in users without AI. */
export function splitArticleLocally(content: string): CardSplitResult[] {
  const paragraphs = content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    throw new Error('内容为空，无法拆分');
  }

  const cards: CardSplitResult[] = [];
  let buffer = '';

  const flush = (label: string) => {
    if (!buffer.trim()) return;
    cards.push({
      content: buffer.trim(),
      semantic_label: label,
      context_summary: '本地拆分的知识片段',
    });
    buffer = '';
  };

  for (const paragraph of paragraphs) {
    if (buffer.length + paragraph.length > 180 && buffer.length > 0) {
      flush(cards.length === 0 ? '开篇' : '知识片段');
    }
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
  }
  flush(cards.length === 0 ? '全文' : '小结');

  return cards.length > 0
    ? cards
    : [
        {
          content: content.trim(),
          semantic_label: '全文',
          context_summary: '整篇作为一张卡片',
        },
      ];
}

export async function splitArticle(content: string): Promise<CardSplitResult[]> {
  if (!isAIConfigured()) {
    return splitArticleLocally(content);
  }

  const systemPrompt = `你是一个专业的教育内容拆分专家。你的任务是将长文章按语义结构拆分成适合碎片化学习的卡片。

拆分原则：
1. 按语义单元拆分，而非按字数。每张卡片应该是一个完整的知识点、概念、例子或论点。
2. 卡片长度适中（通常50-200字），提炼核心内容，不是原文逐段切块。
3. 保持上下文连贯性。
4. 为每张卡片标注语义类型（如：概念定义、举例说明、核心论点、背景介绍、总结归纳等）。
5. 提供简短的上下文摘要。

请以 JSON 数组格式返回，每个元素包含：
- content: 卡片内容（提炼后的核心）
- semantic_label: 语义类型标签
- context_summary: 上下文摘要

只返回 JSON 数组，不要其他内容。`;

  try {
    const response = await callOpenAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请将以下文章拆分成学习卡片：\n\n${content}` },
      ],
      false
    );
    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || '[]';
    const rawCards = parseJsonArray<
      Partial<CardSplitResult> & { text?: string; label?: string; context?: string }
    >(resultText);
    const cards = rawCards
      .map((card) => ({
        content: String(card.content || card.text || '').trim(),
        semantic_label: String(card.semantic_label || card.label || '知识片段').trim(),
        context_summary: String(card.context_summary || card.context || '来自当前资料').trim(),
      }))
      .filter((card) => card.content.length > 0);
    if (cards.length === 0) {
      throw new AIResponseParseError('AI 没有返回有效卡片', resultText);
    }
    return cards;
  } catch (error) {
    console.warn('AI split failed, falling back to local split', error);
    return splitArticleLocally(content);
  }
}

export async function generateTitle(content: string): Promise<string> {
  const fallback = () => {
    const firstLine = content.trim().split(/\n/)[0]?.trim() || '未命名资料';
    return firstLine.length > 24 ? `${firstLine.slice(0, 24)}…` : firstLine;
  };

  if (!isAIConfigured()) return fallback();

  try {
    const response = await callOpenAI(
      [
        {
          role: 'system',
          content:
            '为学习资料起一个简短中文标题（8–18字）。只返回 JSON 数组，形如 [{"title":"..."}]。',
        },
        { role: 'user', content: content.slice(0, 1200) },
      ],
      false
    );
    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || '[]';
    const parsed = parseJsonArray<{ title?: string }>(resultText);
    const title = parsed[0]?.title?.trim();
    return title || fallback();
  } catch {
    return fallback();
  }
}

export async function explainSelection(
  selectedText: string,
  cardContent: string
): Promise<string> {
  if (!isAIConfigured()) {
    return `「${selectedText}」出现在当前卡片中。请结合上下文理解：${cardContent.slice(0, 200)}…`;
  }

  const response = await callOpenAI(
    [
      {
        role: 'system',
        content: '你是耐心的学习助手。用简洁中文解释用户选中的句子或概念，结合卡片上下文。',
      },
      {
        role: 'user',
        content: `卡片内容：\n${cardContent}\n\n请解释这段选中文字：\n${selectedText}`,
      },
    ],
    false
  );

  // Non-stream with json schema may wrap oddly — request plain text via a simple object schema workaround:
  // Actually we used json_array format. Ask for [{explanation: "..."}]
  const data = await response.json();
  const resultText = data.choices?.[0]?.message?.content || '';
  try {
    const parsed = parseJsonArray<{ explanation?: string; content?: string }>(resultText);
    return (
      parsed[0]?.explanation?.trim() ||
      parsed[0]?.content?.trim() ||
      resultText.trim() ||
      '暂无解释'
    );
  } catch {
    return resultText.trim() || '暂无解释';
  }
}
