#!/usr/bin/env node
/**
 * Optional: download Expo Go for iOS Simulator.
 * Often fails on restricted networks — prefer `npm run ios:run` instead.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SDK = process.env.EXPO_GO_SDK || '57';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    cwd: options.cwd ?? ROOT,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return result.stdout ?? '';
}

function printFallback(reason) {
  console.error('');
  console.error(`✗ Expo Go install failed: ${reason}`);
  console.error('');
  console.error('Your network cannot reach Expo’s download API reliably.');
  console.error('Skip Expo Go and build with Xcode instead:');
  console.error('');
  console.error('  npm run ios:run');
  console.error('');
  console.error('First build takes a few minutes; later launches are fast.');
  console.error('Manual Expo Go (if you have a mirror/VPN): https://expo.dev/go → SDK 57 → iOS Simulator');
}

function ensureSimulator() {
  run('open', ['-a', 'Simulator']);
  for (let i = 0; i < 30; i++) {
    const booted = run('xcrun', ['simctl', 'list', 'devices', 'booted'], { capture: true });
    if (booted.includes('Booted')) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error('No iOS Simulator is booted. Open Simulator and try again.');
}

function findDownloadedApp() {
  const apps = readdirSync(ROOT).filter((name) => name.endsWith('.app'));
  const expo = apps.find((name) => /expo.?go/i.test(name)) || apps[0];
  return expo ? path.join(ROOT, expo) : null;
}

function findCachedApp() {
  const home = process.env.HOME;
  if (!home) return null;
  const cacheRoot = path.join(home, '.expo');
  if (!existsSync(cacheRoot)) return null;

  const stack = [cacheRoot];
  while (stack.length) {
    const dir = stack.pop();
    let names;
    try {
      names = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of names) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name.endsWith('.app') && /expo/i.test(entry.name)) {
        return full;
      }
      if (entry.isDirectory() && !entry.name.startsWith('.') && stack.length < 40) {
        stack.push(full);
      }
    }
  }
  return null;
}

console.log(`▶ Installing Expo Go (SDK ${SDK}) on iOS Simulator`);
console.log('  Prefer npm run ios:run if downloads keep failing.');
console.log('');

try {
  ensureSimulator();
} catch (error) {
  printFallback(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

let appPath = findCachedApp();
if (appPath) {
  console.log(`✓ Found cached Expo Go: ${appPath}`);
} else {
  console.log('↓ Downloading Expo Go...');
  try {
    run('npx', ['--yes', 'expo-go', 'download', 'ios', SDK]);
  } catch (error) {
    printFallback(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  appPath = findDownloadedApp() || findCachedApp();
}

if (!appPath || !existsSync(appPath)) {
  printFallback('no .app found after download');
  process.exit(1);
}

console.log(`↑ Installing ${appPath} ...`);
try {
  run('xcrun', ['simctl', 'uninstall', 'booted', 'host.exp.Exponent']);
} catch {
  // not installed yet
}
run('xcrun', ['simctl', 'install', 'booted', appPath]);

const localApp = findDownloadedApp();
if (localApp && localApp.startsWith(ROOT)) {
  try {
    rmSync(localApp, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

console.log('');
console.log('✓ Expo Go installed. Next: npm start  → press i');
