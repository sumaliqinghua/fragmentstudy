import assert from 'node:assert/strict';
import test from 'node:test';
import { getSessionUserId } from './sessionUser.ts';

test('session routing uses the restored local user without a remote auth lookup', async () => {
  let sessionReads = 0;

  const userId = await getSessionUserId(async () => {
    sessionReads += 1;
    return {
      data: {
        session: {
          user: { id: 'user-123' },
        },
      },
      error: null,
    };
  });

  assert.equal(userId, 'user-123');
  assert.equal(sessionReads, 1);
});

test('session routing treats a missing restored session as a guest', async () => {
  const userId = await getSessionUserId(async () => ({
    data: { session: null },
    error: null,
  }));

  assert.equal(userId, null);
});

test('session routing surfaces storage errors instead of silently using guest mode', async () => {
  const failure = new Error('session storage failed');

  await assert.rejects(
    getSessionUserId(async () => ({
      data: { session: null },
      error: failure,
    })),
    failure
  );
});
