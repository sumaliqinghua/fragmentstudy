#!/usr/bin/env node

import { ensureLocalSupabaseEnv } from './lib/ensure-local-supabase.mjs';
import {
  DEV_PROFILES,
  applyDevProfile,
  getEnvSummary,
  maskSecret,
} from './lib/env-files.mjs';
import {
  formatEnvironmentAudit,
  getLocalSupabaseSetupGuide,
  runEnvironmentAudit,
} from './lib/dev-prerequisites.mjs';
import {
  MOBILE_PLATFORMS,
  getMobileEnvSummary,
  syncMobileEnvForProfile,
  writeMobileEnv,
} from './lib/mobile-env.mjs';
import {
  printBlock,
  selectInteractive,
  confirmInteractive,
  pauseInteractive,
} from './lib/prompt.mjs';
import { startExpo } from './lib/start-expo.mjs';
import { run } from './lib/run.mjs';
import { ROOT } from './lib/env-files.mjs';

function printStatusBanner() {
  const summary = getEnvSummary();
  const mobile = getMobileEnvSummary();

  const supabaseMode =
    summary.profile === DEV_PROFILES.LOCAL_SUPABASE
      ? '本地 Supabase'
      : summary.profile === DEV_PROFILES.GUEST
        ? '访客模式'
        : summary.supabaseUrl
          ? '远程 / .env.local'
          : '访客模式';

  printBlock('FragmentStudy Mobile', [
    `  Web 档案: ${supabaseMode}`,
    `  Web Supabase: ${summary.supabaseUrl || '（未配置）'}`,
    `  apps/mobile/.env: ${mobile.hasMobileEnv ? '✓' : '✗ 未生成'}`,
    `  Mobile URL: ${mobile.mobileSupabaseUrl || '（访客 / 未配置）'}`,
    `  Mobile AI: ${mobile.mobilePlatformAi || 'false'}`,
    `  Anon key: ${summary.supabaseAnonKey ? maskSecret(summary.supabaseAnonKey) : '（未配置）'}`,
  ]);
}

async function pickPlatform() {
  const choice = await selectInteractive({
    title: '选择运行平台',
    items: [
      { key: MOBILE_PLATFORMS.IOS, label: 'iOS Simulator（127.0.0.1）' },
      { key: MOBILE_PLATFORMS.ANDROID, label: 'Android Emulator（10.0.2.2）' },
      { key: MOBILE_PLATFORMS.DEVICE, label: '真机 / Expo Go（局域网 IP）' },
    ],
  });
  return choice?.key ?? null;
}

async function launchMobile({ profile, platform, ensureLocal = false, reset = false }) {
  if (ensureLocal) {
    const status = ensureLocalSupabaseEnv({ reset });
    applyDevProfile(DEV_PROFILES.LOCAL_SUPABASE, status);
    printBlock('本地 Supabase 已就绪', [
      `  API:    ${status.apiUrl}`,
      `  Studio: ${status.studioUrl ?? 'http://127.0.0.1:54323'}`,
      ...(status.inbucketUrl ? [`  邮件:   ${status.inbucketUrl}`] : []),
    ]);
  } else if (profile === DEV_PROFILES.REMOTE) {
    applyDevProfile(DEV_PROFILES.REMOTE);
  } else if (profile === DEV_PROFILES.GUEST) {
    applyDevProfile(DEV_PROFILES.GUEST);
  }

  const synced = syncMobileEnvForProfile(profile, platform);
  printBlock('已写入 apps/mobile/.env', [
    `  EXPO_PUBLIC_SUPABASE_URL=${synced.supabaseUrl || '（空 — 访客模式）'}`,
    `  EXPO_PUBLIC_PLATFORM_AI_ENABLED=${synced.platformAi}`,
  ]);

  await startExpo({ platform, clearCache: true });
}

async function handleStartLocal({ reset = false } = {}) {
  const platform = await pickPlatform();
  if (!platform) return;

  try {
    await launchMobile({
      profile: DEV_PROFILES.LOCAL_SUPABASE,
      platform,
      ensureLocal: true,
      reset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printBlock('本地 Supabase 启动失败', getLocalSupabaseSetupGuide(message));
    await pauseInteractive();
  }
}

async function handleStartRemote() {
  const summary = getEnvSummary();
  if (!summary.supabaseUrl) {
    console.log('');
    console.log('提示: .env.local 中未配置 Supabase，将以访客模式运行 mobile。');
    const proceed = await confirmInteractive('仍要启动吗？', true);
    if (proceed === null || !proceed) return;
  }

  const platform = await pickPlatform();
  if (!platform) return;

  await launchMobile({
    profile: summary.supabaseUrl ? DEV_PROFILES.REMOTE : DEV_PROFILES.GUEST,
    platform,
  });
}

async function handleStartGuest() {
  const platform = await pickPlatform();
  if (!platform) return;
  await launchMobile({ profile: DEV_PROFILES.GUEST, platform });
}

async function handleSyncEnvOnly() {
  const profileChoice = await selectInteractive({
    title: '同步 mobile .env 自…',
    items: [
      { key: DEV_PROFILES.LOCAL_SUPABASE, label: '本地 Supabase（先启动 stack）' },
      { key: DEV_PROFILES.REMOTE, label: '.env.local / 远程' },
      { key: DEV_PROFILES.GUEST, label: '访客模式（清空 Supabase）' },
    ],
  });
  if (!profileChoice) return;

  const platform = await pickPlatform();
  if (!platform) return;

  if (profileChoice.key === DEV_PROFILES.LOCAL_SUPABASE) {
    try {
      const status = ensureLocalSupabaseEnv();
      applyDevProfile(DEV_PROFILES.LOCAL_SUPABASE, status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      printBlock('失败', getLocalSupabaseSetupGuide(message));
      await pauseInteractive();
      return;
    }
  }

  const synced = syncMobileEnvForProfile(profileChoice.key, platform);
  printBlock('已同步', [`  ${synced.path}`, `  URL: ${synced.supabaseUrl || '（空）'}`]);
  await pauseInteractive();
}

async function handleSupabaseMenu() {
  const choice = await selectInteractive({
    title: 'Supabase 管理',
    items: [
      { key: 'start', label: '启动本地 Supabase' },
      { key: 'status', label: '查看状态' },
      { key: 'reset', label: '重置数据库（db reset）' },
      { key: 'stop', label: '停止本地 Supabase' },
    ],
  });

  if (!choice) return;

  try {
    if (choice.key === 'start') {
      const status = ensureLocalSupabaseEnv();
      applyDevProfile(DEV_PROFILES.LOCAL_SUPABASE, status);
      printBlock('已启动', [
        `  API:    ${status.apiUrl}`,
        `  Studio: ${status.studioUrl ?? 'http://127.0.0.1:54323'}`,
      ]);
    }
    if (choice.key === 'status') run('supabase', ['status'], { cwd: ROOT, inherit: true });
    if (choice.key === 'reset') {
      const confirmed = await confirmInteractive('确认重置本地数据库？', false);
      if (confirmed) {
        run('supabase', ['db', 'reset'], { cwd: ROOT, inherit: true });
        const status = ensureLocalSupabaseEnv();
        applyDevProfile(DEV_PROFILES.LOCAL_SUPABASE, status);
        console.log('数据库已重置。');
      }
    }
    if (choice.key === 'stop') run('supabase', ['stop'], { cwd: ROOT, inherit: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printBlock('操作失败', getLocalSupabaseSetupGuide(message));
  }

  await pauseInteractive();
}

async function showEnvironmentCheck() {
  const audit = runEnvironmentAudit();
  printBlock('环境检查', formatEnvironmentAudit(audit));
  await pauseInteractive();
}

async function mainMenu() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    printStatusBanner();

    const choice = await selectInteractive({
      title: 'Mobile 开发环境',
      allowBack: false,
      hint: '↑↓ 移动 · Enter 确认 · Esc 退出',
      items: [
        { key: 'local_ios', label: '本地 Supabase + iOS' },
        { key: 'local_android', label: '本地 Supabase + Android' },
        { separator: '  ── 其他启动方式 ──' },
        { key: 'remote', label: '使用 .env.local + 选择平台' },
        { key: 'guest', label: '访客模式 + 选择平台' },
        { separator: '  ── 工具 ──' },
        { key: 'sync', label: '仅同步 apps/mobile/.env' },
        { key: 'supabase', label: 'Supabase 管理' },
        { key: 'check', label: '检查开发环境' },
        { key: 'local_reset', label: '重置 DB + 本地 Supabase + 选择平台' },
        { separator: '  ──' },
        { key: 'quit', label: '退出' },
      ],
    });

    if (!choice || choice.key === 'quit') {
      console.log('再见。');
      return;
    }

    switch (choice.key) {
      case 'local_ios':
        try {
          await launchMobile({
            profile: DEV_PROFILES.LOCAL_SUPABASE,
            platform: MOBILE_PLATFORMS.IOS,
            ensureLocal: true,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          printBlock('失败', getLocalSupabaseSetupGuide(message));
          await pauseInteractive();
        }
        return;
      case 'local_android':
        try {
          await launchMobile({
            profile: DEV_PROFILES.LOCAL_SUPABASE,
            platform: MOBILE_PLATFORMS.ANDROID,
            ensureLocal: true,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          printBlock('失败', getLocalSupabaseSetupGuide(message));
          await pauseInteractive();
        }
        return;
      case 'remote':
        await handleStartRemote();
        return;
      case 'guest':
        await handleStartGuest();
        return;
      case 'sync':
        await handleSyncEnvOnly();
        break;
      case 'supabase':
        await handleSupabaseMenu();
        break;
      case 'check':
        await showEnvironmentCheck();
        break;
      case 'local_reset':
        await handleStartLocal({ reset: true });
        return;
      default:
        break;
    }
  }
}

async function main() {
  const platformArg = process.argv.find((arg) => ['ios', 'android'].includes(arg));
  const localFlag = process.argv.includes('--local');
  const guestFlag = process.argv.includes('--guest');
  const resetFlag = process.argv.includes('--reset');

  if (platformArg || localFlag || guestFlag) {
    const platform =
      platformArg === 'android' ? MOBILE_PLATFORMS.ANDROID : MOBILE_PLATFORMS.IOS;

    if (guestFlag) {
      writeMobileEnv({ profile: DEV_PROFILES.GUEST, platform });
      await startExpo({ platform, clearCache: true });
      return;
    }

    if (localFlag) {
      await launchMobile({
        profile: DEV_PROFILES.LOCAL_SUPABASE,
        platform,
        ensureLocal: true,
        reset: resetFlag,
      });
      return;
    }

    const summary = getEnvSummary();
    syncMobileEnvForProfile(
      summary.supabaseUrl ? DEV_PROFILES.REMOTE : DEV_PROFILES.GUEST,
      platform
    );
    await startExpo({ platform, clearCache: true });
    return;
  }

  console.log('');
  console.log('FragmentStudy Mobile Dev Menu');
  console.log('启动本地 Supabase 并运行 iOS / Android');
  await mainMenu();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
