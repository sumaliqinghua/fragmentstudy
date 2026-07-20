export interface SupabasePublicConfig {
  url: string;
  networkUrl: string;
  anonKey: string;
  isConfigured: boolean;
  error: string | null;
}

const FALLBACK_URL = 'http://127.0.0.1:54321';
const FALLBACK_ANON_KEY = 'supabase-not-configured';

function resolveBrowserUrl(rawUrl: string | undefined): string | undefined {
  const value = rawUrl?.trim();
  if (!value || /^https?:\/\//i.test(value)) return value || undefined;

  const origin = globalThis.location?.origin;
  if (!origin || origin === 'null') return value;

  try {
    return new URL(value, origin).toString();
  } catch {
    return value;
  }
}

export function resolveSupabaseConfig(
  rawUrl: string | undefined,
  rawAnonKey: string | undefined,
  rawBrowserUrl?: string | undefined
): SupabasePublicConfig {
  const networkUrl = rawUrl?.trim();
  const browserUrl = resolveBrowserUrl(rawBrowserUrl);
  const anonKey = rawAnonKey?.trim();
  const isConfigured = Boolean(networkUrl && anonKey);

  return {
    url: browserUrl || networkUrl || FALLBACK_URL,
    networkUrl: networkUrl || FALLBACK_URL,
    anonKey: anonKey || FALLBACK_ANON_KEY,
    isConfigured,
    error: isConfigured
      ? null
      : 'Supabase 未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。',
  };
}
