import { DEFAULT_AI_MODEL, isAllowedAIModel } from './aiModels.ts';

export interface PlatformAIEnvironment {
  QINIU_API_KEY?: string;
  QINIU_API_ENDPOINT?: string;
  QINIU_MODEL?: string;
}

export interface PlatformAIConfig {
  apiKey: string;
  apiEndpoint: string;
  model: string;
}

export interface ProxyMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ValidatedProxyRequest {
  model?: string;
  messages: ProxyMessage[];
  stream: boolean;
  temperature: number;
  responseFormat?: Record<string, unknown>;
}

export class ProxyRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProxyRequestError';
    this.status = status;
  }
}

export function extractBearerToken(header: string | null): string {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new ProxyRequestError('请先登录后使用 AI 生成功能', 401);
  return match[1];
}

export function resolvePlatformAIConfig(
  env: PlatformAIEnvironment,
  requestedModel?: string,
): PlatformAIConfig {
  const apiKey = env.QINIU_API_KEY?.trim();
  if (!apiKey) throw new ProxyRequestError('平台 AI 服务未配置', 503);

  let endpoint: URL;
  try {
    endpoint = new URL(env.QINIU_API_ENDPOINT?.trim() || 'https://api.qnaigc.com/v1');
  } catch {
    throw new ProxyRequestError('平台 AI 地址配置无效', 500);
  }
  if (endpoint.protocol !== 'https:') {
    throw new ProxyRequestError('平台 AI 地址配置无效', 500);
  }

  const model = requestedModel?.trim() || env.QINIU_MODEL?.trim() || DEFAULT_AI_MODEL;
  if (!isAllowedAIModel(model)) {
    throw new ProxyRequestError('当前模型不支持', 400);
  }

  return {
    apiKey,
    apiEndpoint: endpoint.toString().replace(/\/$/, ''),
    model,
  };
}

export function validateProxyRequestBody(value: unknown): ValidatedProxyRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProxyRequestError('请求内容格式无效', 400);
  }

  const body = value as Record<string, unknown>;
  if ('apiKey' in body || 'apiEndpoint' in body) {
    throw new ProxyRequestError('客户端不能指定平台 AI 凭据或地址', 400);
  }
  if (body.model !== undefined && typeof body.model !== 'string') {
    throw new ProxyRequestError('模型参数格式无效', 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 100) {
    throw new ProxyRequestError('缺少有效的对话内容', 400);
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
      role: message.role as ProxyMessage['role'],
      content: message.content,
    };
  });

  const stream = body.stream ?? false;
  if (typeof stream !== 'boolean') {
    throw new ProxyRequestError('流式参数格式无效', 400);
  }
  const temperature = body.temperature ?? 0.7;
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new ProxyRequestError('温度参数必须在 0 到 2 之间', 400);
  }
  if (
    body.response_format !== undefined
    && (!body.response_format || typeof body.response_format !== 'object' || Array.isArray(body.response_format))
  ) {
    throw new ProxyRequestError('响应格式参数无效', 400);
  }

  return {
    model: typeof body.model === 'string' ? body.model : undefined,
    messages,
    stream,
    temperature,
    responseFormat: body.response_format as Record<string, unknown> | undefined,
  };
}
