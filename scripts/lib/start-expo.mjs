import { spawnProcess } from './run.mjs';
import { MOBILE_DIR } from './mobile-env.mjs';

/** Faster Hermes/Maven downloads in CN — React Native reads ENTERPRISE_REPOSITORY. */
const DEFAULT_MAVEN_MIRROR = 'https://maven.aliyun.com/repository/central';

/**
 * Prefer `expo run:ios|android` (local native build) over Expo Go downloads,
 * which often timeout on restricted networks.
 */
export function startExpo({ platform = null, clearCache = false } = {}) {
  let args;

  if (platform === 'ios') {
    args = ['expo', 'run:ios'];
  } else if (platform === 'android') {
    args = ['expo', 'run:android'];
  } else {
    args = ['expo', 'start'];
    if (clearCache) args.push('-c');
  }

  const label =
    platform === 'ios'
      ? 'iOS (expo run:ios — local Xcode build)'
      : platform === 'android'
        ? 'Android (expo run:android)'
        : 'Expo Metro';

  const env = {
    ...process.env,
    ENTERPRISE_REPOSITORY:
      process.env.ENTERPRISE_REPOSITORY || DEFAULT_MAVEN_MIRROR,
  };

  console.log('');
  console.log(`▶ 启动 ${label}`);
  console.log(`  目录: ${MOBILE_DIR}`);
  console.log('  首次原生编译可能需要几分钟；不依赖 Expo Go CDN');
  if (platform === 'ios') {
    console.log(`  Hermes Maven: ${env.ENTERPRISE_REPOSITORY}`);
  }
  console.log('  按 Ctrl+C 停止');
  console.log('');

  const expo = spawnProcess('npx', args, { cwd: MOBILE_DIR, env });

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
