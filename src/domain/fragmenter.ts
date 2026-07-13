import type { Fragment } from './project.ts';

interface FragmentMaterialInput {
  projectMaterialId: string;
  content: string;
  targetLength: number;
}

export type FragmentDraft = Omit<Fragment, 'id'>;

export function fragmentMaterial(input: FragmentMaterialInput): readonly FragmentDraft[] {
  if (!input.content.trim()) throw new Error('Material content is required');
  if (!Number.isInteger(input.targetLength) || input.targetLength <= 0) {
    throw new Error('Fragment target length must be a positive integer');
  }

  const chunks: Array<{ text: string; start: number; end: number }> = [];
  const matcher = /[^。！？!?\n]+[。！？!?]?|\n+/g;
  let pending: { text: string; start: number; end: number } | undefined;

  for (const match of input.content.matchAll(matcher)) {
    const raw = match[0];
    if (!raw.trim()) continue;
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const start = (match.index ?? 0) + leading;
    const end = (match.index ?? 0) + raw.length - trailing;
    const text = input.content.slice(start, end);

    if (text.length > input.targetLength) {
      if (pending) {
        chunks.push(pending);
        pending = undefined;
      }
      for (let offset = 0; offset < text.length; offset += input.targetLength) {
        const pieceStart = start + offset;
        const pieceEnd = Math.min(end, pieceStart + input.targetLength);
        chunks.push({ text: input.content.slice(pieceStart, pieceEnd), start: pieceStart, end: pieceEnd });
      }
      continue;
    }

    if (pending && pending.text.length + text.length <= input.targetLength) {
      pending = { text: input.content.slice(pending.start, end), start: pending.start, end };
    } else {
      if (pending) chunks.push(pending);
      pending = { text, start, end };
    }
  }
  if (pending) chunks.push(pending);

  return Object.freeze(chunks.map((chunk, order) => Object.freeze({
    projectMaterialId: input.projectMaterialId,
    order,
    content: chunk.text,
    sourceText: chunk.text,
    sourceStart: chunk.start,
    sourceEnd: chunk.end,
  })));
}
