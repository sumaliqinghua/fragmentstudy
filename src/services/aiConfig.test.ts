import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AI_MODEL,
  loadAIModel,
  resolveAIAvailability,
  saveAIModel,
  type StringStore,
} from './aiConfig.ts';

function createStore(): StringStore & { values(): string[] } {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    values: () => [...values.values()],
  };
}

test('platform AI availability does not depend on a browser API key', () => {
  assert.equal(resolveAIAvailability('true', false), true);
  assert.equal(resolveAIAvailability(undefined, true), true);
  assert.equal(resolveAIAvailability(undefined, false), false);
});

test('model preferences contain no API endpoint or key', () => {
  const store = createStore();
  saveAIModel('qwen/qwen3.7-plus', store);

  assert.equal(loadAIModel(store), 'qwen/qwen3.7-plus');
  assert.equal(store.values().some(value => /apiKey|apiEndpoint/i.test(value)), false);
  assert.equal(loadAIModel(undefined), DEFAULT_AI_MODEL);
});

test('legacy settings migrate only the selected model', () => {
  const store = createStore();
  store.setItem('openai_config', JSON.stringify({
    apiKey: 'must-not-migrate',
    apiEndpoint: 'https://untrusted.example/v1',
    model: 'z-ai/glm-5.2',
  }));

  assert.equal(loadAIModel(store), 'z-ai/glm-5.2');
  assert.equal(store.values().some(value => value.includes('must-not-migrate')), false);
  const migrated = store.getItem('ai_model_preference');
  assert.deepEqual(JSON.parse(migrated ?? '{}'), { model: 'z-ai/glm-5.2' });
});

test('unknown models fall back to the platform default', () => {
  const store = createStore();
  saveAIModel('unknown/model', store);

  assert.equal(loadAIModel(store), DEFAULT_AI_MODEL);
});

test('existing model preferences still remove legacy browser credentials', () => {
  const store = createStore();
  saveAIModel('qwen/qwen3.7-plus', store);
  store.setItem('openai_config', JSON.stringify({
    apiKey: 'remove-even-when-new-preference-exists',
    model: 'z-ai/glm-5.2',
  }));

  assert.equal(loadAIModel(store), 'qwen/qwen3.7-plus');
  assert.equal(store.getItem('openai_config'), null);
  assert.equal(
    store.values().some(value => value.includes('remove-even-when-new-preference-exists')),
    false,
  );
});
