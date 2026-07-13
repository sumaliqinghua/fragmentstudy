export type FragmentRelationship = 'unmet' | 'familiar' | 'revisit';

interface MapFragment {
  id: string;
  content: string;
  order: number;
}

interface MapExposure {
  fragmentId: string;
  exposedAt: string;
}

export interface ProjectMapNode {
  id: string;
  label: string;
  available: true;
  relationship: FragmentRelationship;
  hint: string;
}

export function createProjectMap(input: { fragments: readonly MapFragment[]; exposures: readonly MapExposure[] }): readonly ProjectMapNode[] {
  const contactCounts = new Map<string, number>();
  for (const exposure of input.exposures) {
    contactCounts.set(exposure.fragmentId, (contactCounts.get(exposure.fragmentId) ?? 0) + 1);
  }
  return [...input.fragments]
    .sort((left, right) => left.order - right.order)
    .map((fragment) => {
      const count = contactCounts.get(fragment.id) ?? 0;
      const relationship: FragmentRelationship = count === 0 ? 'unmet' : count === 1 ? 'familiar' : 'revisit';
      return {
        id: fragment.id,
        label: fragment.content,
        available: true as const,
        relationship,
        hint: relationship === 'unmet' ? '想看时再认识它' : relationship === 'familiar' ? '已经见过一面' : '可以换种方式再碰一次',
      };
    });
}
