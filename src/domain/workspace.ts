import { fragmentMaterial } from './fragmenter.ts';
import type { Fragment, Material, Project, ProjectMaterial } from './project.ts';
import { createSession, pauseSession, resumeSession, type LearningSession } from './session.ts';
import { createSessionPlan } from './sessionPlan.ts';

export interface LearningProject {
  readonly project: Project;
  readonly materials: readonly Material[];
  readonly projectMaterials: readonly ProjectMaterial[];
  readonly fragments: readonly Fragment[];
}

export type ExposureKind = 'seen' | 'later' | 'revisit';

export interface Exposure {
  readonly id: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly fragmentId: string;
  readonly kind: ExposureKind;
  readonly exposedAt: string;
}

export interface LearningWorkspace {
  readonly projects: readonly LearningProject[];
  readonly sessions: readonly LearningSession[];
  readonly exposures: readonly Exposure[];
  readonly activeProjectId?: string;
}

interface ImportTextProjectInput {
  title: string;
  content: string;
  now: string;
  createId: () => string;
}

export function createWorkspace(): LearningWorkspace {
  return { projects: [], sessions: [], exposures: [] };
}

export function importTextProject(workspace: LearningWorkspace, input: ImportTextProjectInput): LearningWorkspace {
  if (!input.title.trim()) throw new Error('Project title is required');
  const projectId = input.createId();
  const materialId = input.createId();
  const projectMaterialId = input.createId();
  const project: Project = { id: projectId, title: input.title.trim(), createdAt: input.now };
  const material: Material = { id: materialId, title: input.title.trim(), sourceType: 'text', content: input.content, createdAt: input.now };
  const projectMaterial: ProjectMaterial = { id: projectMaterialId, projectId, materialId, createdAt: input.now };
  const fragments = fragmentMaterial({ projectMaterialId, content: input.content, targetLength: 18 })
    .map((fragment) => ({ id: input.createId(), ...fragment }));
  const plan = createSessionPlan({
    projectId,
    projectMaterialId,
    fragments: fragments.map((fragment) => ({ ...fragment, projectId })),
    limit: Math.min(5, fragments.length),
  });
  const session = createSession({ id: input.createId(), mode: 'card', plan, now: input.now });

  return {
    ...workspace,
    projects: [...workspace.projects, { project, materials: [material], projectMaterials: [projectMaterial], fragments }],
    sessions: [...workspace.sessions, session],
    activeProjectId: projectId,
  };
}

export function startWorkspaceSession(
  workspace: LearningWorkspace,
  input: { projectId: string; now: string },
): LearningWorkspace {
  const session = findSession(workspace, input.projectId);
  const resumed = resumeSession(session, { cursor: session.cursor, now: input.now });
  return replaceSession(workspace, resumed, input.projectId);
}

export function advanceWorkspaceSession(
  workspace: LearningWorkspace,
  input: { projectId: string; now: string; kind?: ExposureKind; createId?: () => string },
): LearningWorkspace {
  const session = findSession(workspace, input.projectId);
  if (session.status !== 'active') throw new Error('Session must be active before advancing');
  const fragmentId = session.itemIds[session.cursor];
  const exposure: Exposure = {
    id: input.createId?.() ?? crypto.randomUUID(),
    projectId: session.projectId,
    sessionId: session.id,
    fragmentId,
    kind: input.kind ?? 'seen',
    exposedAt: input.now,
  };
  const advanced = resumeSession(session, {
    cursor: Math.min(session.cursor + 1, session.itemIds.length - 1),
    now: input.now,
  });
  return {
    ...replaceSession(workspace, advanced, input.projectId),
    exposures: [...workspace.exposures, exposure],
  };
}

export function pauseWorkspaceSession(
  workspace: LearningWorkspace,
  input: { projectId: string; now: string },
): LearningWorkspace {
  return replaceSession(workspace, pauseSession(findSession(workspace, input.projectId), { now: input.now }), input.projectId);
}

function findSession(workspace: LearningWorkspace, projectId: string): LearningSession {
  const session = workspace.sessions.find((candidate) => candidate.projectId === projectId);
  if (!session) throw new Error('Session not found for project');
  return session;
}

function replaceSession(workspace: LearningWorkspace, session: LearningSession, activeProjectId: string): LearningWorkspace {
  return {
    ...workspace,
    sessions: workspace.sessions.map((candidate) => candidate.id === session.id ? session : candidate),
    activeProjectId,
  };
}
