import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeWorkspace, encodeWorkspace } from '../../src/domain/workspaceStorage.ts';
import { createWorkspace } from '../../src/domain/workspace.ts';

test('workspace storage round-trips the project-scoped learning state', () => {
  const workspace = { ...createWorkspace(), activeProjectId: 'project-a' };
  assert.deepEqual(decodeWorkspace(encodeWorkspace(workspace)), workspace);
});

test('workspace storage safely falls back when local data is missing or corrupt', () => {
  assert.deepEqual(decodeWorkspace(null), createWorkspace());
  assert.deepEqual(decodeWorkspace('{broken'), createWorkspace());
});
