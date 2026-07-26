import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnProcess } from './run.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export function startVite() {
  console.log('');
  console.log('▶ 启动 Vite → http://localhost:5173');
  console.log('  按 Ctrl+C 停止');
  console.log('');

  const vite = spawnProcess('npx', ['vite'], { cwd: ROOT });

  const shutdown = (signal) => {
    if (!vite.killed) vite.kill(signal);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return new Promise((resolve) => {
    vite.on('exit', (code, signal) => {
      resolve(signal ? 0 : (code ?? 0));
    });
  });
}
