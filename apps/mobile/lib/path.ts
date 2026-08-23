import { CARDS_PER_STOP, CHEST_EVERY_STOPS } from './theme';
import type { Card, LearningProgress, PathNode } from './types';

export function stopCountFromCards(cardCount: number): number {
  if (cardCount <= 0) return 0;
  return Math.ceil(cardCount / CARDS_PER_STOP);
}

export function stopIndexForCard(cardIndex: number): number {
  return Math.floor(cardIndex / CARDS_PER_STOP);
}

export function cardRangeForStop(stopIndex: number, cardCount: number): {
  start: number;
  end: number;
} {
  const start = stopIndex * CARDS_PER_STOP;
  const end = Math.min(cardCount - 1, start + CARDS_PER_STOP - 1);
  return { start, end };
}

/**
 * Build a Duolingo-style path from cards + progress.
 * Progress.completed_count is number of cards finished (0..n).
 */
export function buildPathNodes(
  cards: Card[],
  progress: LearningProgress | null | undefined
): PathNode[] {
  const cardCount = cards.length;
  const stops = stopCountFromCards(cardCount);
  if (stops === 0) return [];

  const completedCards = progress?.completed_count ?? 0;

  let currentStopIndex = 0;
  for (let i = 0; i < stops; i++) {
    const { end } = cardRangeForStop(i, cardCount);
    if (completedCards <= end) {
      currentStopIndex = i;
      break;
    }
    currentStopIndex = i;
  }
  if (completedCards >= cardCount) {
    currentStopIndex = stops;
  }

  const nodes: PathNode[] = [];
  for (let i = 0; i < stops; i++) {
    const { start, end } = cardRangeForStop(i, cardCount);
    let status: PathNode['status'];
    if (completedCards > end) {
      status = 'done';
    } else if (i === currentStopIndex && completedCards < cardCount) {
      status = 'current';
    } else {
      status = 'locked';
    }

    nodes.push({
      id: `stop-${i}`,
      kind: 'stop',
      status,
      label: `第 ${i + 1} 关`,
      number: i + 1,
      actionLabel: status === 'current' ? (completedCards > start ? '继续' : '开始') : undefined,
      cardStart: start,
      cardEnd: end,
    });

    if ((i + 1) % CHEST_EVERY_STOPS === 0 && i < stops - 1) {
      const chestUnlocked = completedCards > end;
      nodes.push({
        id: `chest-${i}`,
        kind: 'chest',
        status: chestUnlocked ? 'opened' : 'locked',
        label: '礼物宝箱',
      });
    }
  }

  if (stops > 0) {
    nodes.push({
      id: 'chest-finish',
      kind: 'chest',
      status: completedCards >= cardCount ? 'opened' : 'locked',
      label: '通关宝箱',
    });
  }

  return nodes;
}

export function currentStopNode(nodes: PathNode[]): PathNode | undefined {
  return nodes.find((n) => n.kind === 'stop' && n.status === 'current');
}

export function formatStopProgress(progress: LearningProgress | null | undefined, cardCount: number): string {
  const stops = stopCountFromCards(cardCount);
  if (stops === 0) return '未开始';
  const completedCards = progress?.completed_count ?? 0;
  const doneStops = Math.min(stops, Math.floor(completedCards / CARDS_PER_STOP));
  if (completedCards >= cardCount) return `已通关 · ${stops} 关`;
  return `第 ${Math.min(doneStops + 1, stops)} / ${stops} 关`;
}
