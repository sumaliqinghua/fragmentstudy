export interface PlannableFragment {
  id: string;
  projectId: string;
  projectMaterialId: string;
  order: number;
}

interface CreateSessionPlanInput {
  projectId: string;
  projectMaterialId: string;
  fragments: readonly PlannableFragment[];
  limit: number;
}

export interface SessionPlan {
  readonly projectId: string;
  readonly projectMaterialId: string;
  readonly fragmentIds: readonly string[];
}

export function createSessionPlan(input: CreateSessionPlanInput): SessionPlan {
  if (!Number.isInteger(input.limit) || input.limit <= 0) {
    throw new Error('Session plan limit must be a positive integer');
  }

  const eligibleFragments = input.fragments
    .filter((fragment) => (
      fragment.projectId === input.projectId
      && fragment.projectMaterialId === input.projectMaterialId
    ));
  if (eligibleFragments.length === 0) {
    throw new Error('Session plan requires eligible fragments');
  }

  const uniqueIds = new Set(eligibleFragments.map((fragment) => fragment.id));
  if (uniqueIds.size !== eligibleFragments.length) {
    throw new Error('Session plan contains a duplicate fragment');
  }

  const fragmentIds = eligibleFragments
    .sort((left, right) => left.order - right.order)
    .slice(0, input.limit)
    .map((fragment) => fragment.id);

  return Object.freeze({
    projectId: input.projectId,
    projectMaterialId: input.projectMaterialId,
    fragmentIds: Object.freeze(fragmentIds),
  });
}
