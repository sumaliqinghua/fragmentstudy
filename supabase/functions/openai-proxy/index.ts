import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  extractBearerToken,
  ProxyRequestError,
  resolvePlatformAIConfig,
  validateProxyRequestBody,
} from '../_shared/openaiProxySecurity.ts';

const MAX_BODY_BYTES = 5_000_000;
const encoder = new TextEncoder();
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  Vary: 'Origin',
};

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new ProxyRequestError(`服务端缺少 ${name} 配置`, 500);
  return value;
}

async function authenticateUser(token: string): Promise<void> {
  const client = createClient(
    requireEnvironment('SUPABASE_URL'),
    requireEnvironment('SUPABASE_ANON_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new ProxyRequestError('登录已失效，请重新登录', 401);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: '仅支持 POST 请求' });
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: '请求内容过大' });
  }

  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    await authenticateUser(token);

    const rawBody = await request.text();
    if (encoder.encode(rawBody).byteLength > MAX_BODY_BYTES) {
      throw new ProxyRequestError('请求内容过大', 413);
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new ProxyRequestError('请求内容不是有效 JSON', 400);
    }
    const body = validateProxyRequestBody(parsedBody);
    const config = resolvePlatformAIConfig(
      {
        QINIU_API_KEY: Deno.env.get('QINIU_API_KEY'),
        QINIU_API_ENDPOINT: Deno.env.get('QINIU_API_ENDPOINT'),
        QINIU_MODEL: Deno.env.get('QINIU_MODEL'),
      },
      body.model,
    );

    let upstream: Response;
    try {
      upstream = await fetch(`${config.apiEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: body.messages,
          stream: body.stream,
          temperature: body.temperature,
          ...(body.responseFormat ? { response_format: body.responseFormat } : {}),
        }),
      });
    } catch {
      throw new ProxyRequestError('平台 AI 服务暂时无法连接', 502);
    }

    if (!upstream.ok) {
      return jsonResponse(502, {
        error: `平台 AI 请求失败 (${upstream.status})`,
      });
    }

    const headers = new Headers(corsHeaders);
    headers.set(
      'Content-Type',
      body.stream ? 'text/event-stream' : (upstream.headers.get('content-type') || 'application/json'),
    );
    headers.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    if (error instanceof ProxyRequestError) {
      return jsonResponse(error.status, { error: error.message });
    }
    return jsonResponse(500, { error: 'AI 代理发生内部错误' });
  }
});
