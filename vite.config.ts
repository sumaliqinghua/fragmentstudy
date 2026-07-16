import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function localOpenAIProxy(env: Record<string, string>): Plugin {
  return {
    name: 'local-openai-proxy',
    configureServer(server) {
      server.middlewares.use('/openai-proxy', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const authorization = request.headers.authorization;
          const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
          const anonKey = env.VITE_SUPABASE_ANON_KEY;
          if (!authorization?.match(/^Bearer\s+\S+$/i)) {
            response.statusCode = 401;
            response.end(JSON.stringify({ error: '请先登录后使用 AI 生成功能' }));
            return;
          }
          if (!supabaseUrl || !anonKey) {
            response.statusCode = 503;
            response.end(JSON.stringify({ error: '本地 Supabase 尚未配置' }));
            return;
          }

          const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              Authorization: authorization,
              apikey: anonKey,
            },
          });
          if (!authResponse.ok) {
            response.statusCode = 401;
            response.end(JSON.stringify({ error: '登录已失效，请重新登录' }));
            return;
          }

          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of request) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > 5_000_000) throw new Error('请求内容过大');
            chunks.push(buffer);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            model?: string;
            messages?: { role: string; content: string }[];
            stream?: boolean;
            temperature?: number;
            response_format?: unknown;
          };
          const apiKey = env.QINIU_API_KEY;
          const apiEndpoint = env.QINIU_API_ENDPOINT || 'https://api.qnaigc.com/v1';
          const model = body.model || env.QINIU_MODEL || 'qwen/qwen3.7-plus';
          if (!apiKey) throw new Error('本地 .env 中未配置 QINIU_API_KEY');
          if (!body.messages?.length) throw new Error('缺少对话内容');

          const upstream = await fetch(`${apiEndpoint.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: body.messages,
              stream: body.stream ?? false,
              temperature: body.temperature ?? 0.7,
              ...(body.response_format ? { response_format: body.response_format } : {}),
            }),
          });

          response.statusCode = upstream.status;
          response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
          response.setHeader('Cache-Control', 'no-cache');
          if (!upstream.body) {
            response.end();
            return;
          }
          const reader = upstream.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            response.write(Buffer.from(value));
          }
          response.end();
        } catch (error) {
          response.statusCode = 502;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : '本地 AI 代理失败' }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const hasLocalAIKey = Boolean(env.QINIU_API_KEY);

  return {
    plugins: [react(), localOpenAIProxy(env)],
    define: {
      'import.meta.env.VITE_LOCAL_AI_CONFIGURED': JSON.stringify(hasLocalAIKey),
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: supabaseUrl
      ? {
          proxy: {
            '/content-extractor': {
              target: supabaseUrl,
              changeOrigin: true,
              secure: true,
              rewrite: (path) => path.replace(/^\/content-extractor/, '/functions/v1/content-extractor'),
            },
          },
        }
      : undefined,
  };
});
