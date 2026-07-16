import assert from 'node:assert/strict';
import test from 'node:test';
import { streamOpenAIContent } from './aiStream.ts';

test('stream parser preserves SSE lines and UTF-8 split across network chunks', async () => {
  const bytes = new TextEncoder().encode([
    'data: {"choices":[{"delta":{"content":"你"}}]}\n',
    'data: {"choices":[{"delta":{"content":"好"}}]}\n',
    'data: [DONE]\n',
  ].join(''));
  const splitInsideChineseCharacter = bytes.indexOf(0xe4) + 1;
  const chunks = [
    bytes.slice(0, 9),
    bytes.slice(9, splitInsideChineseCharacter),
    bytes.slice(splitInsideChineseCharacter, 63),
    bytes.slice(63),
  ];
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }));

  const output: string[] = [];
  for await (const content of streamOpenAIContent(response)) output.push(content);

  assert.deepEqual(output, ['你', '好']);
});

test('stream parser flushes a final SSE line without a newline', async () => {
  const response = new Response('data: {"choices":[{"delta":{"content":"final"}}]}');
  const output: string[] = [];
  for await (const content of streamOpenAIContent(response)) output.push(content);

  assert.deepEqual(output, ['final']);
});
