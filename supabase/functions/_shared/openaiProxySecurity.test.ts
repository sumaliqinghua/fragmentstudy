import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractBearerToken,
  resolvePlatformAIConfig,
  validateProxyRequestBody,
} from './openaiProxySecurity.ts';

test('extractBearerToken rejects anonymous and malformed requests', () => {
  assert.throws(() => extractBearerToken(null), /登录/);
  assert.throws(() => extractBearerToken('Basic abc'), /登录/);
  assert.throws(() => extractBearerToken('Bearer   '), /登录/);
  assert.equal(extractBearerToken('Bearer user-token'), 'user-token');
});

test('server configuration rejects unknown models and missing secrets', () => {
  assert.throws(() => resolvePlatformAIConfig({}, 'qwen/qwen3.7-plus'), /未配置/);
  assert.throws(
    () => resolvePlatformAIConfig({ QINIU_API_KEY: 'secret' }, 'unknown/model'),
    /不支持/,
  );
  assert.equal(
    resolvePlatformAIConfig({ QINIU_API_KEY: 'secret' }, 'qwen/qwen3.7-plus').apiKey,
    'secret',
  );
});

test('server configuration owns and normalizes the upstream endpoint', () => {
  const config = resolvePlatformAIConfig({
    QINIU_API_KEY: 'secret',
    QINIU_API_ENDPOINT: 'https://api.qnaigc.com/v1/',
    QINIU_MODEL: 'qwen/qwen3.7-plus',
  });

  assert.equal(config.apiEndpoint, 'https://api.qnaigc.com/v1');
  assert.equal(config.model, 'qwen/qwen3.7-plus');
});

test('server configuration rejects malformed or insecure endpoints', () => {
  assert.throws(
    () => resolvePlatformAIConfig({ QINIU_API_KEY: 'secret', QINIU_API_ENDPOINT: 'not-a-url' }),
    /地址配置无效/,
  );
  assert.throws(
    () => resolvePlatformAIConfig({ QINIU_API_KEY: 'secret', QINIU_API_ENDPOINT: 'http://example.com/v1' }),
    /地址配置无效/,
  );
});

test('request validation rejects client-owned credentials and malformed prompts', () => {
  assert.throws(
    () => validateProxyRequestBody({ apiKey: 'browser-secret', messages: [] }),
    /不能指定/,
  );
  assert.throws(() => validateProxyRequestBody({ messages: [] }), /对话内容/);
  assert.throws(
    () => validateProxyRequestBody({ messages: [{ role: 'tool', content: 'hello' }] }),
    /对话内容格式/,
  );
});

test('request validation keeps only supported upstream fields', () => {
  const body = validateProxyRequestBody({
    model: 'qwen/qwen3.7-plus',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    unrelated: 'discard-me',
  });

  assert.deepEqual(body, {
    model: 'qwen/qwen3.7-plus',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
    temperature: 0.4,
    responseFormat: { type: 'json_object' },
  });
});
