export async function* streamOpenAIContent(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应');

  const decoder = new TextDecoder();
  let pending = '';

  function* parseCompleteLines(flush = false): Generator<string> {
    const lines = pending.split('\n');
    pending = flush ? '' : (lines.pop() ?? '');

    for (const rawLine of lines) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data) as {
          choices?: { delta?: { content?: unknown } }[];
        };
        const content = parsed.choices?.[0]?.delta?.content;
        if (typeof content === 'string' && content) yield content;
      } catch {
        continue;
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    yield* parseCompleteLines();
  }

  pending += decoder.decode();
  if (pending) {
    pending += '\n';
    yield* parseCompleteLines(true);
  }
}
