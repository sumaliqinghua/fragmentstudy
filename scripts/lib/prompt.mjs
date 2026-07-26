import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const HIDE_CURSOR = '\x1B[?25l';
const SHOW_CURSOR = '\x1B[?25h';
const CLEAR_LINE = '\x1B[2K';
const moveUp = (n) => `\x1B[${n}A`;

function isInteractive() {
  return Boolean(input.isTTY && output.isTTY);
}

function parseKey(data) {
  if (data === '\u0003') return 'ctrl-c';
  if (data === '\r' || data === '\n') return 'enter';
  if (data === '\u001b') return 'escape';
  if (data === '\u001b[A' || data === '\x1b[A') return 'up';
  if (data === '\u001b[B' || data === '\x1b[B') return 'down';
  if (data === 'k') return 'up';
  if (data === 'j') return 'down';
  if (/^[0-9]$/.test(data)) return { type: 'number', value: data };
  return null;
}

function buildRows(items, { allowBack }) {
  const rows = [];
  const selectable = [];

  for (const item of items) {
    if (item.separator) {
      rows.push({ kind: 'separator', text: item.separator });
      continue;
    }
    const index = selectable.length;
    selectable.push(item);
    rows.push({ kind: 'option', item, index });
  }

  if (allowBack) {
    const backItem = { key: '__back__', label: '← 返回' };
    selectable.push(backItem);
    rows.push({ kind: 'option', item: backItem, index: selectable.length - 1 });
  }

  return { rows, selectable };
}

function formatOptionLine(label, selected) {
  if (selected) return `\x1b[36m\x1b[1m❯ ${label}\x1b[0m`;
  return `  ${label}`;
}

async function selectFallback({ title, items, allowBack }) {
  const rl = readline.createInterface({ input, output });
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      console.log('');
      console.log(title);
      console.log('─'.repeat(Math.min(title.length, 48)));
      for (const item of items) {
        if (item.separator) {
          console.log(item.separator);
          continue;
        }
        console.log(`  ${item.key}) ${item.label}`);
      }
      if (allowBack) console.log('  0) 返回');
      console.log('');

      const answer = (await rl.question('请选择: ')).trim();
      if (allowBack && answer === '0') return null;
      const match = items.find((item) => !item.separator && item.key === answer);
      if (match) return match;
      console.log('无效选项，请重试。');
    }
  } finally {
    rl.close();
  }
}

export async function selectInteractive({
  title,
  items,
  allowBack = true,
  hint = '↑↓ 移动 · Enter 确认 · Esc 返回 · j/k 移动',
  initialIndex = 0,
}) {
  if (!isInteractive()) {
    return selectFallback({ title, items, allowBack });
  }

  const { rows, selectable } = buildRows(items, { allowBack });
  if (selectable.length === 0) return null;

  let selected = Math.min(Math.max(initialIndex, 0), selectable.length - 1);
  let renderedLines = 0;

  return new Promise((resolve) => {
    const cleanup = (result) => {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
      output.write(SHOW_CURSOR);
      if (renderedLines > 0) {
        output.write(moveUp(renderedLines));
        for (let i = 0; i < renderedLines; i += 1) {
          output.write(CLEAR_LINE);
          if (i < renderedLines - 1) output.write('\n');
        }
        output.write('\n');
      }
      resolve(result);
    };

    const render = () => {
      const lines = ['', title, '─'.repeat(Math.min(title.length, 52))];

      for (const row of rows) {
        if (row.kind === 'separator') {
          lines.push(row.text);
          continue;
        }
        lines.push(formatOptionLine(row.item.label, row.index === selected));
      }

      lines.push('');
      lines.push(`\x1b[2m  ${hint}\x1b[0m`);

      if (renderedLines > 0) output.write(moveUp(renderedLines));
      for (const line of lines) {
        output.write(`${CLEAR_LINE}${line}\n`);
      }
      renderedLines = lines.length;
    };

    const onData = (chunk) => {
      const data = String(chunk);
      const key = parseKey(data);

      if (key === 'ctrl-c') {
        cleanup(undefined);
        process.exit(130);
      }

      if (key === 'escape') {
        if (!allowBack) {
          const quitItem = selectable.find((item) => item.key === 'quit');
          cleanup(quitItem ?? null);
        } else {
          cleanup(null);
        }
        return;
      }

      if (key === 'enter') {
        const picked = selectable[selected];
        cleanup(picked?.key === '__back__' ? null : picked ?? null);
        return;
      }

      if (key === 'up') {
        selected = (selected - 1 + selectable.length) % selectable.length;
        render();
        return;
      }

      if (key === 'down') {
        selected = (selected + 1) % selectable.length;
        render();
        return;
      }

      if (key?.type === 'number') {
        const match = items.find((item) => !item.separator && item.key === key.value);
        if (match) {
          cleanup(match);
        }
      }
    };

    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    output.write(HIDE_CURSOR);
    render();
    input.on('data', onData);
  });
}

export async function confirmInteractive(message, defaultYes = true) {
  const choice = await selectInteractive({
    title: message,
    allowBack: true,
    items: [
      { key: 'yes', label: defaultYes ? '是 (默认)' : '是' },
      { key: 'no', label: defaultYes ? '否' : '否 (默认)' },
    ],
    initialIndex: defaultYes ? 0 : 1,
    hint: '↑↓ 移动 · Enter 确认 · Esc 取消',
  });

  if (!choice) return null;
  return choice.key === 'yes';
}

export async function pauseInteractive(message = '按 Enter 继续...') {
  if (!isInteractive()) {
    console.log(message);
    return;
  }

  const rl = readline.createInterface({ input, output });
  try {
    await rl.question(`\n\x1b[2m${message}\x1b[0m`);
  } finally {
    rl.close();
  }
}

export async function askInteractive(message, { defaultValue, mask = false } = {}) {
  const rl = readline.createInterface({ input, output });
  try {
    const suffix = defaultValue !== undefined ? ` \x1b[2m[${mask ? '****' : defaultValue}]\x1b[0m` : '';
    const answer = (await rl.question(`\n${message}${suffix}: `)).trim();
    if (!answer && defaultValue !== undefined) return defaultValue;
    return answer;
  } finally {
    rl.close();
  }
}

export function printBlock(title, lines) {
  console.log('');
  console.log(title);
  console.log('─'.repeat(Math.min(title.length, 52)));
  for (const line of lines) console.log(line);
}

// Legacy exports (non-interactive fallback)
export function createPrompt() {
  return readline.createInterface({ input, output });
}

export async function ask(rl, question, options) {
  return askInteractive(question, options);
}

export async function confirm(rl, question, defaultYes = true) {
  const result = await confirmInteractive(question, defaultYes);
  if (result === null) return false;
  return result;
}

export async function selectMenu(rl, title, items, options) {
  return selectInteractive({ title, items, ...options });
}

export function pause(rl, message) {
  return pauseInteractive(message);
}
