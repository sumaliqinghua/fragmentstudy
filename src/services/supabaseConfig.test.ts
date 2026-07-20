import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSupabaseConfig } from './supabaseConfig.ts';

test('missing Supabase values keep guest mode available', () => {
  const config = resolveSupabaseConfig(undefined, '');

  assert.equal(config.isConfigured, false);
  assert.match(config.error ?? '', /VITE_SUPABASE_URL/);
  assert.equal(config.url, 'http://127.0.0.1:54321');
  assert.equal(config.anonKey, 'supabase-not-configured');
});

test('configured Supabase values are trimmed and accepted', () => {
  const config = resolveSupabaseConfig(' https://example.supabase.co ', ' anon-key ');

  assert.equal(config.isConfigured, true);
  assert.equal(config.error, null);
  assert.equal(config.url, 'https://example.supabase.co');
  assert.equal(config.anonKey, 'anon-key');
});

test('a browser proxy URL overrides the network target without changing configuration validity', () => {
  const config = resolveSupabaseConfig(
    ' https://racknerd.example.ts.net:8443 ',
    ' anon-key ',
    ' http://127.0.0.1:5182/supabase-proxy '
  );

  assert.equal(config.isConfigured, true);
  assert.equal(config.url, 'http://127.0.0.1:5182/supabase-proxy');
  assert.equal(config.networkUrl, 'https://racknerd.example.ts.net:8443');
});

test('a relative browser proxy URL resolves against the current browser origin', () => {
  const originalLocation = globalThis.location;
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { origin: 'http://localhost:5183' },
  });

  try {
    const config = resolveSupabaseConfig(
      'https://network.example.supabase.co',
      ' anon-key ',
      '/supabase-proxy',
    );

    assert.equal(config.url, 'http://localhost:5183/supabase-proxy');
    assert.equal(config.networkUrl, 'https://network.example.supabase.co');
  } finally {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: originalLocation,
    });
  }
});
