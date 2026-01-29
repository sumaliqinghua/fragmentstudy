import type { Card, LearningProgress, QuizQuestion } from '../types';

export type PathNodeType = 'card' | 'quiz' | 'chest';
export type PathNodeStatus = 'completed' | 'current' | 'locked';

export interface PathNode {
  id: string;
  type: PathNodeType;
  status: PathNodeStatus;
  label: string;
  cardIds?: string[];
  cardRange?: [number, number];
  quizIds?: string[];
  milestone?: 30 | 60 | 80;
  claimed?: boolean;
}

interface GeneratePathOptions {
  cards: Card[];
  quizzes: QuizQuestion[];
  progress: LearningProgress | null;
  claimedMilestones: number[];
  cardsPerNode?: number;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function generateLearningPath(options: GeneratePathOptions): PathNode[] {
  const { cards, quizzes, progress, claimedMilestones, cardsPerNode = 5 } = options;
  const cardGroups = chunkArray(cards, cardsPerNode);
  const cardNodes: PathNode[] = cardGroups.map((group, index) => {
    const start = index * cardsPerNode;
    const end = start + group.length - 1;
    return {
      id: `card-${index}`,
      type: 'card',
      status: 'locked',
      label: `Card ${start + 1}-${end + 1}`,
      cardIds: group.map((card) => card.id),
      cardRange: [start, end],
    };
  });

  const quizGroups = chunkArray(quizzes, 2);
  const quizNodes: PathNode[] = quizGroups.map((group, index) => {
    const start = index * 2 + 1;
    const end = start + group.length - 1;
    return {
      id: `quiz-${index}`,
      type: 'quiz',
      status: 'locked',
      label: `Quiz ${start}${group.length > 1 ? `-${end}` : ''}`,
      quizIds: group.map((quiz) => quiz.id),
    };
  });

  let combined: PathNode[] = [...cardNodes];

  if (quizNodes.length && cardNodes.length) {
    quizNodes.forEach((quizNode, index) => {
      const insertAfter = Math.floor(((index + 1) * cardNodes.length) / (quizNodes.length + 1));
      const insertIndex = clamp(insertAfter + 1, 0, combined.length);
      combined.splice(insertIndex, 0, quizNode);
    });
  } else if (quizNodes.length) {
    combined = [...quizNodes];
  }

  if (combined.length) {
    const milestones: Array<30 | 60 | 80> = [30, 60, 80];
    milestones.forEach((milestone, index) => {
      const position = clamp(
        Math.floor((combined.length * milestone) / 100) + index,
        0,
        combined.length
      );
      combined.splice(position, 0, {
        id: `chest-${milestone}`,
        type: 'chest',
        status: 'locked',
        label: `${milestone}% Chest`,
        milestone,
        claimed: claimedMilestones.includes(milestone),
      });
    });
  }

  let currentNodeIndex = 0;
  if (cardNodes.length) {
    const safeIndex = clamp(progress?.current_index ?? 0, 0, cards.length - 1);
    const cardNodeIndex = Math.floor(safeIndex / cardsPerNode);
    const currentNodeId = cardNodes[cardNodeIndex]?.id;
    const combinedIndex = combined.findIndex((node) => node.id === currentNodeId);
    currentNodeIndex = combinedIndex === -1 ? 0 : combinedIndex;
  }

  return combined.map((node, index) => {
    let status: PathNodeStatus = 'locked';
    if (index < currentNodeIndex) status = 'completed';
    if (index === currentNodeIndex) status = 'current';
    if (node.type === 'chest' && node.claimed) status = 'completed';
    return { ...node, status };
  });
}
