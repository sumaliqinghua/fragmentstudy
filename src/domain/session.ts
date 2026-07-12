import type { SessionPlan } from './sessionPlan.ts';

export type LearningMode = 'card' | 'dialogue' | 'galgame';
export type SessionStatus = 'ready' | 'active' | 'ended';
export type SessionEndReason = 'completed' | 'enough_for_today' | 'switch_mode';

export interface LearningSession {
  readonly id: string;
  readonly projectId: string;
  readonly projectMaterialId: string;
  readonly mode: LearningMode;
  readonly itemIds: readonly string[];
  readonly cursor: number;
  readonly status: SessionStatus;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly endReason?: SessionEndReason;
}

interface CreateSessionInput {
  id: string;
  mode: LearningMode;
  plan: SessionPlan;
  now: string;
}

function freezeSession(session: LearningSession): LearningSession {
  return Object.freeze({
    ...session,
    itemIds: Object.freeze([...session.itemIds]),
  });
}

export function createSession(input: CreateSessionInput): LearningSession {
  if (input.plan.fragmentIds.length === 0) {
    throw new Error('Cannot create a session from an empty plan');
  }

  return freezeSession({
    id: input.id,
    projectId: input.plan.projectId,
    projectMaterialId: input.plan.projectMaterialId,
    mode: input.mode,
    itemIds: input.plan.fragmentIds,
    cursor: 0,
    status: 'ready',
    startedAt: input.now,
    updatedAt: input.now,
  });
}

export function resumeSession(
  session: LearningSession,
  input: { cursor: number; now: string },
): LearningSession {
  if (session.status === 'ended') {
    throw new Error('Cannot resume an ended session');
  }
  if (!Number.isInteger(input.cursor) || input.cursor < 0) {
    throw new Error('Session cursor must be a non-negative integer');
  }
  const lastCursor = Math.max(0, session.itemIds.length - 1);
  return freezeSession({
    ...session,
    cursor: Math.min(Math.max(0, input.cursor), lastCursor),
    status: 'active',
    updatedAt: input.now,
  });
}

export function endSession(
  session: LearningSession,
  input: { reason: SessionEndReason; now: string },
): LearningSession {
  return freezeSession({
    ...session,
    status: 'ended',
    endReason: input.reason,
    updatedAt: input.now,
  });
}
