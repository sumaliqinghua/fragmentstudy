import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractUrlContent,
  setContentImportEnvForTesting,
} from './contentImport.ts';

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

function installFetchStub(impl: typeof fetch): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

function setContentImportEnv(env: Parameters<typeof setContentImportEnvForTesting>[0]): () => void {
  setContentImportEnvForTesting(env);
  return () => setContentImportEnvForTesting(null);
}

test('configured dev imports send the anon key and restored user token separately', async () => {
  const calls: FetchCall[] = [];
  const restoreFetch = installFetchStub(async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ title: 'Extractor title', content: '正文'.repeat(60) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const restoreEnv = setContentImportEnv({
    DEV: true,
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  });

  try {
    const result = await extractUrlContent(
      'https://juejin.cn/post/1',
      undefined,
      'user-token',
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, '/content-extractor');
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer user-token');
    assert.equal((calls[0].init?.headers as Record<string, string>).apikey, 'anon-key');
    assert.equal(result.title, 'Extractor title');
    assert.deepEqual(result.warnings, []);
  } finally {
    restoreEnv();
    restoreFetch();
  }
});

test('configured guest imports fall back to Jina only when the extractor returns 401', async () => {
  const calls: FetchCall[] = [];
  const restoreFetch = installFetchStub(async (input, init) => {
    calls.push({ input, init });
    if (calls.length === 1) {
      return new Response(JSON.stringify({ error: '请先登录后导入网页' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      [
        'Title: Jina title',
        '',
        'A long enough body for the fallback path to succeed.',
        '',
        '![Cover](https://cdn.example.com/cover.png)',
        '!Image 1https://cdn.example.com/broken.png?a=1',
      ].join('\n'),
      { status: 200 }
    );
  });
  const restoreEnv = setContentImportEnv({
    DEV: false,
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  });

  try {
    const result = await extractUrlContent('https://juejin.cn/post/2');

    assert.deepEqual(
      calls.map(call => call.input),
      [
        'https://example.supabase.co/functions/v1/content-extractor',
        'https://r.jina.ai/https://juejin.cn/post/2',
      ]
    );
    assert.match(result.warnings[0] ?? '', /备用网页识别服务/);
    assert.match(result.content, /!\[Cover\]\(https:\/\/cdn\.example\.com\/cover\.png\)/);
    assert.match(result.content, /!\[Image 1\]\(https:\/\/cdn\.example\.com\/broken\.png\?a=1\)/);
  } finally {
    restoreEnv();
    restoreFetch();
  }
});

test('authenticated imports surface extractor errors without disclosing the URL to Jina', async () => {
  const calls: FetchCall[] = [];
  const restoreFetch = installFetchStub(async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ error: '识别到的正文过短，请检查链接' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const restoreEnv = setContentImportEnv({
    DEV: false,
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  });

  try {
    await assert.rejects(
      () => extractUrlContent('https://private.example.com/article', undefined, 'user-token'),
      /识别到的正文过短/,
    );
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].input,
      'https://example.supabase.co/functions/v1/content-extractor',
    );
  } finally {
    restoreEnv();
    restoreFetch();
  }
});

test('unconfigured imports go straight to Jina without a fallback warning', async () => {
  const calls: FetchCall[] = [];
  const restoreFetch = installFetchStub(async (input) => {
    calls.push({ input });
    return new Response(
      [
        'Title: Guest title',
        '',
        'A long enough body for the guest path to succeed.',
        '',
        '![Logo](https://cdn.example.com/logo.png)',
        '!Image 1https://cdn.example.com/guest.png',
      ].join('\n'),
      { status: 200 }
    );
  });
  const restoreEnv = setContentImportEnv({
    DEV: true,
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_ANON_KEY: '',
  });

  try {
    const result = await extractUrlContent('juejin.cn/post/3');

    assert.deepEqual(calls.map(call => call.input), ['https://r.jina.ai/https://juejin.cn/post/3']);
    assert.deepEqual(result.warnings, []);
    assert.match(result.content, /!\[Logo\]\(https:\/\/cdn\.example\.com\/logo\.png\)/);
    assert.match(result.content, /!\[Image 1\]\(https:\/\/cdn\.example\.com\/guest\.png\)/);
  } finally {
    restoreEnv();
    restoreFetch();
  }
});
