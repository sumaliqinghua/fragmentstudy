import assert from 'node:assert/strict';
import test from 'node:test';
import { createSession, endSession, resumeSession } from '../../src/domain/session.ts';

test('resume preserves the project and mode chosen when a session starts', () => {
  const session = createSession({
    id: 'session-1',
    mode: 'dialogue',
    plan: {
      projectId: 'project-a',
      projectMaterialId: 'material-a',
      fragmentIds: ['item-1', 'item-2'],
    },
    now: '2026-07-13T00:00:00.000Z',
  });

  const resumed = resumeSession(session, { cursor: 1, now: '2026-07-13T01:00:00.000Z' });

  assert.equal(resumed.projectId, 'project-a');
  assert.equal(resumed.mode, 'dialogue');
  assert.equal(resumed.cursor, 1);
  assert.equal(resumed.status, 'active');
  assert.equal(Object.isFrozen(resumed), true);
});

test('a user can end anywhere and an ended session cannot be resumed', () => {
  const session = createSession({
    id: 'session-1',
    mode: 'galgame',
    plan: {
      projectId: 'project-a',
      projectMaterialId: 'material-a',
      fragmentIds: ['item-1', 'item-2'],
    },
    now: '2026-07-13T00:00:00.000Z',
  });

  const ended = endSession(session, {
    reason: 'enough_for_today',
    now: '2026-07-13T00:01:00.000Z',
  });

  assert.equal(ended.status, 'ended');
  assert.equal(ended.endReason, 'enough_for_today');
  assert.throws(
    () => resumeSession(ended, { cursor: 1, now: '2026-07-13T01:00:00.000Z' }),
    /ended session/i,
  );
});

test('an ended session cannot be ended twice', () => {
  const session = createSession({ id: 'session-1', mode: 'card', plan: { projectId: 'project-a', projectMaterialId: 'material-a', fragmentIds: ['item-1'] }, now: '2026-07-13T00:00:00.000Z' });
  const ended = endSession(session, { reason: 'completed', now: '2026-07-13T00:01:00.000Z' });
  assert.throws(() => endSession(ended, { reason: 'completed', now: '2026-07-13T00:02:00.000Z' }), /already ended/i);
});
