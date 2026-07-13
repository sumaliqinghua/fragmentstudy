import { fragmentMaterial } from './fragmenter.ts';
import type { Fragment, Material, Project, ProjectMaterial } from './project.ts';
import { createSession, pauseSession, resumeSession, type LearningMode, type LearningSession } from './session.ts';
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
  readonly activeMode?: LearningMode;
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
  input: { projectId: string; mode?: LearningMode; now: string; createId?: () => string },
): LearningWorkspace {
  const mode = input.mode ?? 'card';
  const activeSession = workspace.sessions.find((candidate) => candidate.projectId === input.projectId && candidate.status === 'active');
  if (activeSession && activeSession.mode !== mode) throw new Error('Pause the current session before switching modes');
  let session = findSession(workspace, input.projectId, mode, false);
  if (!session) {
    const project = workspace.projects.find((candidate) => candidate.project.id === input.projectId);
    if (!project) throw new Error('Project not found');
    const projectMaterialId = project.projectMaterials[0]?.id;
    if (!projectMaterialId) throw new Error('Project material not found');
    const plan = createSessionPlan({
      projectId: input.projectId,
      projectMaterialId,
      fragments: project.fragments.map((fragment) => ({ ...fragment, projectId: input.projectId })),
      limit: Math.min(5, project.fragments.length),
    });
    session = createSession({ id: input.createId?.() ?? crypto.randomUUID(), mode, plan, now: input.now });
    workspace = { ...workspace, sessions: [...workspace.sessions, session] };
  }
  const resumed = resumeSession(session, { cursor: session.cursor, now: input.now });
  return replaceSession(workspace, resumed, input.projectId, mode);
}

export function advanceWorkspaceSession(
  workspace: LearningWorkspace,
  input: { projectId: string; mode?: LearningMode; now: string; kind?: ExposureKind; createId?: () => string },
): LearningWorkspace {
  const mode = input.mode ?? workspace.activeMode ?? 'card';
  const session = findSession(workspace, input.projectId, mode);
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
    ...replaceSession(workspace, advanced, input.projectId, mode),
    exposures: [...workspace.exposures, exposure],
  };
}

export function pauseWorkspaceSession(
  workspace: LearningWorkspace,
  input: { projectId: string; mode?: LearningMode; now: string },
): LearningWorkspace {
  const mode = input.mode ?? workspace.activeMode ?? 'card';
  return replaceSession(workspace, pauseSession(findSession(workspace, input.projectId, mode), { now: input.now }), input.projectId, mode);
}

function findSession(workspace: LearningWorkspace, projectId: string, mode: LearningMode, required?: true): LearningSession;
function findSession(workspace: LearningWorkspace, projectId: string, mode: LearningMode, required: false): LearningSession | undefined;
function findSession(workspace: LearningWorkspace, projectId: string, mode: LearningMode, required = true): LearningSession | undefined {
  const session = workspace.sessions.find((candidate) => candidate.projectId === projectId && candidate.mode === mode);
  if (!session && required) throw new Error('Session not found for project and mode');
  return session;
}

function replaceSession(workspace: LearningWorkspace, session: LearningSession, activeProjectId: string, activeMode: LearningMode): LearningWorkspace {
  return {
    ...workspace,
    sessions: workspace.sessions.map((candidate) => candidate.id === session.id ? session : candidate),
    activeProjectId,
    activeMode,
  };
}
