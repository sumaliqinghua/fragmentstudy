export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
  error: string | null;
}

const FALLBACK_URL = 'http://127.0.0.1:54321';
const FALLBACK_ANON_KEY = 'supabase-not-configured';

export function resolveSupabaseConfig(
  rawUrl: string | undefined,
  rawAnonKey: string | undefined
): SupabasePublicConfig {
  const url = rawUrl?.trim();
  const anonKey = rawAnonKey?.trim();
  const isConfigured = Boolean(url && anonKey);

  return {
    url: url || FALLBACK_URL,
    anonKey: anonKey || FALLBACK_ANON_KEY,
    isConfigured,
    error: isConfigured
      ? null
      : 'Supabase 未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。',
  };
}
