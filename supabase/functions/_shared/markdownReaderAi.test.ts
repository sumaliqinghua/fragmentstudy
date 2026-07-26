import assert from 'node:assert/strict';
import test from 'node:test';
import {
  corsHeadersFor,
  ProxyRequestError,
  validateMarkdownReaderAiRequest,
} from './markdownReaderAi.ts';

test('allows only production reader and explicit local origins', () => {
  assert.equal(
    corsHeadersFor('https://reader.theaimoment.com')['Access-Control-Allow-Origin'],
    'https://reader.theaimoment.com',
  );
  assert.equal(
    corsHeadersFor('http://localhost:60510')['Access-Control-Allow-Origin'],
    'http://localhost:60510',
  );
  assert.equal(corsHeadersFor('https://attacker.example')['Access-Control-Allow-Origin'], undefined);
  assert.equal(corsHeadersFor(null).Vary, 'Origin');
});

test('rejects more than 100 messages with a normalized request error', () => {
  assert.throws(
    () => validateMarkdownReaderAiRequest({
      model: 'qwen/qwen3.7-plus',
      stream: true,
      temperature: 0.7,
      messages: Array.from({ length: 101 }, () => ({ role: 'user', content: 'x' })),
    }),
    (error: unknown) => error instanceof ProxyRequestError
      && error.status === 400
      && /消息数量/.test(error.message),
  );
});

test('requires streaming and rejects browser-owned provider configuration', () => {
  assert.throws(
    () => validateMarkdownReaderAiRequest({
      messages: [{ role: 'user', content: 'hello' }], stream: false,
    }),
    /流式/,
  );
  assert.throws(
    () => validateMarkdownReaderAiRequest({
      messages: [{ role: 'user', content: 'hello' }], stream: true, apiKey: 'browser-secret',
    }),
    /不能指定/,
  );
});

test('validates model, roles, and temperature while discarding unrelated fields', () => {
  assert.throws(
    () => validateMarkdownReaderAiRequest({
      model: 'unknown/model', messages: [{ role: 'user', content: 'hello' }], stream: true,
    }),
    /模型/,
  );
  assert.throws(
    () => validateMarkdownReaderAiRequest({
      messages: [{ role: 'tool', content: 'hello' }], stream: true,
    }),
    /对话内容/,
  );

  assert.deepEqual(validateMarkdownReaderAiRequest({
    model: 'qwen/qwen3.7-plus',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
    temperature: 0.4,
    unrelated: 'discard',
  }), {
    model: 'qwen/qwen3.7-plus',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
    temperature: 0.4,
  });
});
