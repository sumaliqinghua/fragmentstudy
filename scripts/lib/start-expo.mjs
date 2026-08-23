import { spawnProcess } from './run.mjs';
import { MOBILE_DIR } from './mobile-env.mjs';

export function startExpo({ platform = null, clearCache = false } = {}) {
  const args = ['expo', 'start'];
  if (platform === 'ios') args.push('--ios');
  if (platform === 'android') args.push('--android');
  if (clearCache) args.push('-c');

  const label =
    platform === 'ios'
      ? 'iOS Simulator'
      : platform === 'android'
        ? 'Android Emulator'
        : 'Expo (choose platform in terminal)';

  console.log('');
  console.log(`▶ 启动 Expo → ${label}`);
  console.log(`  目录: ${MOBILE_DIR}`);
  console.log('  按 Ctrl+C 停止');
  console.log('');

  const expo = spawnProcess('npx', args, { cwd: MOBILE_DIR });

  const shutdown = (signal) => {
    if (!expo.killed) expo.kill(signal);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return new Promise((resolve) => {
    expo.on('exit', (code, signal) => {
      resolve(signal ? 0 : (code ?? 0));
    });
  });
}
