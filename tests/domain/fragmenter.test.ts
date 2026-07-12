import test from 'node:test';
import assert from 'node:assert/strict';
import { fragmentMaterial } from '../../src/domain/fragmenter.ts';

test('fragmenter creates short traceable learning pieces without losing source order', () => {
  const source = '第一段介绍核心概念。它还提供一个例子。\n\n第二段解释为什么这很重要，并给出可以实践的方法。';
  const fragments = fragmentMaterial({ projectMaterialId: 'material', content: source, targetLength: 18 });

  assert.ok(fragments.length >= 3);
  assert.deepEqual(fragments.map((fragment) => fragment.order), fragments.map((_, index) => index));
  for (const fragment of fragments) {
    assert.equal(source.slice(fragment.sourceStart, fragment.sourceEnd), fragment.sourceText);
    assert.ok(fragment.content.length > 0);
  }
});

test('fragmenter rejects blank material and invalid target sizes', () => {
  assert.throws(() => fragmentMaterial({ projectMaterialId: 'material', content: '  ', targetLength: 18 }), /content/);
  assert.throws(() => fragmentMaterial({ projectMaterialId: 'material', content: '内容', targetLength: 0 }), /target length/);
});
