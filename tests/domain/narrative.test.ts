import test from 'node:test';
import assert from 'node:assert/strict';
import { createDialogueBeat, createGalgameBeat } from '../../src/domain/narrative.ts';

test('dialogue beat keeps the source idea while varying speakers', () => {
  const first = createDialogueBeat({ content: '切成小片段会更容易开始。', index: 0 });
  const second = createDialogueBeat({ content: '隔天再遇见会更熟悉。', index: 1 });
  assert.notEqual(first.speaker, second.speaker);
  assert.match(first.message, /切成小片段/);
  assert.equal(first.sourceText, '切成小片段会更容易开始。');
});

test('galgame beat turns a fragment into a traceable scene', () => {
  const beat = createGalgameBeat({ content: '注意力会受到环境影响。', index: 2 });
  assert.ok(beat.scene.length > 0);
  assert.ok(beat.character.length > 0);
  assert.match(beat.dialogue, /注意力会受到环境影响/);
  assert.equal(beat.sourceText, '注意力会受到环境影响。');
});
