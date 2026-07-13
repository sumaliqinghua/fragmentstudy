import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectMap } from '../../src/domain/projectMap.ts';

test('project map offers direction without locked nodes or completion language', () => {
  const map = createProjectMap({
    fragments: [
      { id: 'a', content: '先认识核心概念', order: 0 },
      { id: 'b', content: '再看看一个具体例子', order: 1 },
      { id: 'c', content: '最后了解使用边界', order: 2 },
    ],
    exposures: [{ fragmentId: 'a', exposedAt: '2026-07-12T00:00:00Z' }],
  });

  assert.equal(map.length, 3);
  assert.ok(map.every((node) => node.available));
  assert.ok(map.every((node) => !/完成|掌握|锁定/.test(node.label)));
  assert.equal(map[0].relationship, 'familiar');
  assert.equal(map[1].relationship, 'unmet');
});

test('natural revisit is an optional invitation based on prior contact', () => {
  const map = createProjectMap({
    fragments: [{ id: 'a', content: '一个值得再看的概念', order: 0 }],
    exposures: [
      { fragmentId: 'a', exposedAt: '2026-07-10T00:00:00Z' },
      { fragmentId: 'a', exposedAt: '2026-07-11T00:00:00Z' },
    ],
  });
  assert.equal(map[0].relationship, 'revisit');
  assert.match(map[0].hint, /可以|想/);
  assert.doesNotMatch(map[0].hint, /必须|逾期|待复习/);
});
