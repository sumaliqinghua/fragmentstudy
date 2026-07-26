import { isAllowedAIModel } from './aiModels.ts';
import { ProxyRequestError } from './openaiProxySecurity.ts';

export { ProxyRequestError } from './openaiProxySecurity.ts';

const ALLOWED_ORIGINS = new Set([
  'https://reader.theaimoment.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:60510',
  'http://127.0.0.1:60510',
]);

export interface MarkdownReaderAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MarkdownReaderAiRequest {
  model?: string;
  messages: MarkdownReaderAiMessage[];
  stream: true;
  temperature: number;
}

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    Vary: 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function validateMarkdownReaderAiRequest(value: unknown): MarkdownReaderAiRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProxyRequestError('请求内容格式无效', 400);
  }
  const body = value as Record<string, unknown>;
  if ('apiKey' in body || 'apiEndpoint' in body) {
    throw new ProxyRequestError('客户端不能指定平台 AI 凭据或地址', 400);
  }
  if (body.model !== undefined && (typeof body.model !== 'string' || !isAllowedAIModel(body.model.trim()))) {
    throw new ProxyRequestError('当前模型不支持', 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 100) {
    throw new ProxyRequestError('消息数量必须在 1 到 100 条之间', 400);
  }

  const allowedRoles = new Set(['system', 'user', 'assistant']);
  const messages = body.messages.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ProxyRequestError('对话内容格式无效', 400);
    }
    const message = value as Record<string, unknown>;
    if (
      typeof message.role !== 'string'
      || !allowedRoles.has(message.role)
      || typeof message.content !== 'string'
      || !message.content.trim()
    ) {
      throw new ProxyRequestError('对话内容格式无效', 400);
    }
    return {
      role: message.role as MarkdownReaderAiMessage['role'],
      content: message.content,
    };
  });

  if (body.stream !== true) {
    throw new ProxyRequestError('阅读器 AI 仅支持流式响应', 400);
  }
  const temperature = body.temperature ?? 0.7;
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new ProxyRequestError('温度参数必须在 0 到 2 之间', 400);
  }
  if ('response_format' in body) {
    throw new ProxyRequestError('阅读器 AI 不支持响应格式覆盖', 400);
  }

  return {
    model: typeof body.model === 'string' ? body.model.trim() : undefined,
    messages,
    stream: true,
    temperature,
  };
}
