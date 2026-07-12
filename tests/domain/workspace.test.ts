import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorkspaceSession, createWorkspace, importTextProject, pauseWorkspaceSession, startWorkspaceSession } from '../../src/domain/workspace.ts';

const ids = (() => {
  let value = 0;
  return () => `id-${++value}`;
})();

test('import creates one isolated project and a ready card session', () => {
  const workspace = importTextProject(createWorkspace(), {
    title: '注意力笔记',
    content: '注意力不是无限资源。减少切换可以保留更多精力。短暂休息也有帮助。',
    now: '2026-07-13T00:00:00Z',
    createId: ids,
  });

  assert.equal(workspace.projects.length, 1);
  assert.equal(workspace.projects[0].materials.length, 1);
  assert.ok(workspace.projects[0].fragments.length >= 2);
  assert.equal(workspace.sessions[0].projectId, workspace.projects[0].project.id);
  assert.equal(workspace.sessions[0].mode, 'card');
});

test('two projects keep independent cards and resume positions', () => {
  let workspace = importTextProject(createWorkspace(), { title: 'A', content: '苹果属于水果。它含有膳食纤维。每天可以适量食用。', now: '2026-07-13T00:00:00Z', createId: ids });
  workspace = importTextProject(workspace, { title: 'B', content: '恒星通过核聚变发光。太阳也是一颗恒星。光到地球需要时间。', now: '2026-07-13T00:01:00Z', createId: ids });
  const [projectA, projectB] = workspace.projects;

  workspace = startWorkspaceSession(workspace, { projectId: projectA.project.id, now: '2026-07-13T00:02:00Z' });
  workspace = advanceWorkspaceSession(workspace, { projectId: projectA.project.id, now: '2026-07-13T00:03:00Z' });
  workspace = pauseWorkspaceSession(workspace, { projectId: projectA.project.id, now: '2026-07-13T00:04:00Z' });
  workspace = startWorkspaceSession(workspace, { projectId: projectB.project.id, now: '2026-07-13T00:05:00Z' });

  const sessionA = workspace.sessions.find((session) => session.projectId === projectA.project.id);
  const sessionB = workspace.sessions.find((session) => session.projectId === projectB.project.id);
  assert.equal(sessionA?.cursor, 1);
  assert.equal(sessionA?.status, 'paused');
  assert.equal(sessionB?.cursor, 0);
  assert.equal(sessionB?.status, 'active');
  assert.ok(projectA.fragments.every((fragment) => !projectB.fragments.some((other) => other.id === fragment.id)));
});

test('advancing records exposure without claiming mastery', () => {
  let workspace = importTextProject(createWorkspace(), { title: 'A', content: '第一点。第二点。第三点。', now: '2026-07-13T00:00:00Z', createId: ids });
  const projectId = workspace.projects[0].project.id;
  workspace = startWorkspaceSession(workspace, { projectId, now: '2026-07-13T00:01:00Z' });
  workspace = advanceWorkspaceSession(workspace, { projectId, now: '2026-07-13T00:02:00Z', kind: 'later' });

  assert.equal(workspace.exposures.length, 1);
  assert.equal(workspace.exposures[0].kind, 'later');
  assert.equal(workspace.exposures[0].projectId, projectId);
  assert.equal('mastered' in workspace.exposures[0], false);
});
