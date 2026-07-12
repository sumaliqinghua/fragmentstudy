import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionPlan } from '../../src/domain/sessionPlan.ts';

test('default session planning never mixes project materials', () => {
  const plan = createSessionPlan({
    projectId: 'project-a',
    projectMaterialId: 'material-a',
    fragments: [
      { id: 'a-1', projectId: 'project-a', projectMaterialId: 'material-a', order: 0 },
      { id: 'b-1', projectId: 'project-a', projectMaterialId: 'material-b', order: 0 },
      { id: 'a-2', projectId: 'project-a', projectMaterialId: 'material-a', order: 1 },
    ],
    limit: 3,
  });

  assert.deepEqual(plan.fragmentIds, ['a-1', 'a-2']);
});

test('a session plan rejects duplicate eligible fragments', () => {
  assert.throws(
    () => createSessionPlan({
      projectId: 'project-a',
      projectMaterialId: 'material-a',
      fragments: [
        { id: 'a-1', projectId: 'project-a', projectMaterialId: 'material-a', order: 0 },
        { id: 'a-1', projectId: 'project-a', projectMaterialId: 'material-a', order: 1 },
      ],
      limit: 3,
    }),
    /duplicate fragment/i,
  );
});

test('a session plan requires a finite positive integer limit and eligible content', () => {
  assert.throws(
    () => createSessionPlan({
      projectId: 'project-a',
      projectMaterialId: 'material-a',
      fragments: [],
      limit: Number.NaN,
    }),
    /positive integer/i,
  );

  assert.throws(
    () => createSessionPlan({
      projectId: 'project-a',
      projectMaterialId: 'material-a',
      fragments: [],
      limit: 3,
    }),
    /eligible fragments/i,
  );
});
