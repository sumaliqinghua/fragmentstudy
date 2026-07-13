import { createWorkspace, type LearningWorkspace } from './workspace.ts';

export const WORKSPACE_STORAGE_KEY = 'fragment-learning:v2:workspace';

export function encodeWorkspace(workspace: LearningWorkspace): string {
  return JSON.stringify(workspace);
}

export function decodeWorkspace(value: string | null): LearningWorkspace {
  if (!value) return createWorkspace();
  try {
    const parsed = JSON.parse(value) as LearningWorkspace;
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.exposures)) {
      return createWorkspace();
    }
    return parsed;
  } catch {
    return createWorkspace();
  }
}
