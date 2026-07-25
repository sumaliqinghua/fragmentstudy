import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Readability } from "npm:@mozilla/readability@0.6.0";
import { parseHTML } from "npm:linkedom@0.18.12";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  extractUserBearerToken,
  FunctionAuthError,
} from "../_shared/functionAuthSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new FunctionAuthError(`服务端缺少 ${name} 配置`, 500);
  return value;
}

async function authenticateUser(token: string): Promise<void> {
  const client = createClient(
    requireEnvironment("SUPABASE_URL"),
    requireEnvironment("SUPABASE_ANON_KEY"),
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
    throw new FunctionAuthError("登录已失效，请重新登录");
  }
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost"
    || host === "0.0.0.0"
    || host === "::1"
    || /^127\./.test(host)
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^169\.254\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

function normalizeText(html: string): string {
  const { document } = parseHTML(`<body>${html}</body>`);
  const blocks = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,pre,blockquote"));
  return blocks
    .map((node) => node.textContent?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function fetchPublicPage(initialUrl: URL, signal: AbortSignal): Promise<Response> {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    if (isPrivateHostname(currentUrl.hostname)) throw new Error("不支持该链接地址");
    const response = await fetch(currentUrl, {
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FragmentArticle/1.0; +https://example.com)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("网页重定向地址无效");
    currentUrl = new URL(location, currentUrl);
  }
  throw new Error("网页重定向次数过多");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = extractUserBearerToken(request.headers.get("authorization"));
    await authenticateUser(token);

    const body = await request.json() as { url?: string };
    const target = new URL(body.url || "");
    if (!["http:", "https:"].includes(target.protocol) || isPrivateHostname(target.hostname)) {
      return json({ error: "不支持该链接地址" }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const upstream = await fetchPublicPage(target, controller.signal).finally(() => clearTimeout(timeout));

    if (!upstream.ok) return json({ error: `网页返回 ${upstream.status}` }, 422);
    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return json({ error: "该链接不是可识别的网页文章" }, 422);
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > 5_000_000) return json({ error: "网页内容过大" }, 413);

    const html = await upstream.text();
    const { document } = parseHTML(html);
    Object.defineProperty(document, "documentURI", { value: target.toString() });
    const article = new Readability(document as unknown as Document, { charThreshold: 80 }).parse();
    if (!article?.content) return json({ error: "未识别到网页正文，可能需要登录或存在付费墙" }, 422);
    const content = normalizeText(article.content);
    if (content.length < 80) return json({ error: "识别到的正文过短，请检查链接" }, 422);

    return json({
      title: article.title || document.title || target.hostname,
      content,
      byline: article.byline || null,
      sourceUrl: target.toString(),
    });
  } catch (error) {
    if (error instanceof FunctionAuthError) {
      return json({ error: error.message }, error.status);
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return json({ error: "网页读取超时" }, 408);
    }
    return json({ error: error instanceof Error ? error.message : "网页识别失败" }, 500);
  }
});
