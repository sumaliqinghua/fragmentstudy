import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlatformAIRequest } from './aiRequest.ts';

test('platform requests carry the user token and no browser secret', () => {
  const request = buildPlatformAIRequest({
    accessToken: 'user-token',
    model: 'qwen/qwen3.7-plus',
    messages: [{ role: 'user', content: 'hello' }],
    stream: false,
    temperature: 0.7,
  });

  assert.equal(request.headers.Authorization, 'Bearer user-token');
  assert.equal('apiKey' in request.body, false);
  assert.equal('apiEndpoint' in request.body, false);
  assert.deepEqual(request.body.messages, [{ role: 'user', content: 'hello' }]);
});

test('response format is omitted unless requested', () => {
  const base = {
    accessToken: 'user-token',
    model: 'qwen/qwen3.7-plus',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
    temperature: 0.7,
  };

  assert.equal('response_format' in buildPlatformAIRequest(base).body, false);
  assert.equal(
    buildPlatformAIRequest({ ...base, responseFormat: { type: 'json_object' } })
      .body.response_format?.type,
    'json_object'
  );
});
