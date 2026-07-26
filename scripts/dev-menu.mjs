#!/usr/bin/env node

import { ensureLocalSupabaseEnv } from './lib/ensure-local-supabase.mjs';
import {
  DEV_PROFILES,
  ENV_LOCAL_PATH,
  ROOT,
  ensureEnvLocalFromExample,
  getEnvSummary,
  listConfigurableKeys,
  maskSecret,
  parseEnvFile,
  applyDevProfile,
  unlinkDevEnv,
  upsertEnvLocal,
} from './lib/env-files.mjs';
import {
  formatEnvironmentAudit,
  getLocalSupabaseSetupGuide,
  runEnvironmentAudit,
} from './lib/dev-prerequisites.mjs';
import {
  printBlock,
  selectInteractive,
  confirmInteractive,
  pauseInteractive,
  askInteractive,
} from './lib/prompt.mjs';
import { startVite } from './lib/start-vite.mjs';
import { run } from './lib/run.mjs';

function printStatusBanner() {
  const summary = getEnvSummary();
  const supabaseMode =
    summary.profile === DEV_PROFILES.LOCAL_SUPABASE
      ? '本地 Supabase'
      : summary.profile === DEV_PROFILES.GUEST
        ? '访客模式'
        : summary.profile === DEV_PROFILES.REMOTE
          ? '远程 / .env.local'
          : summary.hasDevEnv && summary.profile !== '（未选择）'
            ? `自定义 (${summary.profile})`
            : summary.supabaseUrl
              ? '远程 / .env.local'
              : '访客模式';

  printBlock('当前环境', [
    `  配置档案: ${supabaseMode}`,
    `  .env.local: ${summary.hasEnvLocal ? '✓' : '✗ 未创建'}`,
    `  .env.development.local: ${summary.hasDevEnv ? '✓' : '—'}`,
    `  Supabase URL: ${summary.supabaseUrl || '（未配置）'}`,
    `  AI Key: ${summary.qiniuApiKey ? `✓ ${maskSecret(summary.qiniuApiKey)}` : '✗ 未配置'}`,
  ]);
}

async function handleStartRemote() {
  applyDevProfile(DEV_PROFILES.REMOTE);
  const summary = getEnvSummary();
  if (!summary.supabaseUrl) {
    console.log('');
    console.log('提示: 未检测到 VITE_SUPABASE_URL，将以访客模式运行。');
    const proceed = await confirmInteractive('仍要启动前端吗？', true);
    if (proceed === null || !proceed) return;
  } else {
    console.log('');
    console.log(`将使用 .env.local 中的 Supabase: ${summary.supabaseUrl}`);
  }
  await startVite();
}

async function handleStartGuest() {
  applyDevProfile(DEV_PROFILES.GUEST);
  console.log('');
  console.log('已切换为访客模式（忽略 Supabase 配置）。');
  await startVite();
}

async function handleStartLocal({ reset = false } = {}) {
  try {
    const status = ensureLocalSupabaseEnv({ reset });
    printBlock('本地 Supabase 已就绪', [
      `  API:    ${status.apiUrl}`,
      `  Studio: ${status.studioUrl ?? 'http://127.0.0.1:54323'}`,
      ...(status.inbucketUrl ? [`  邮件:   ${status.inbucketUrl}`] : []),
      '  凭证已写入 .env.development.local',
    ]);
    await startVite();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    printBlock('本地 Supabase 启动失败', getLocalSupabaseSetupGuide(message));

    const choice = await selectInteractive({
      title: '接下来怎么做？',
      allowBack: true,
      items: [
        { key: 'retry', label: '重试启动本地 Supabase' },
        { key: 'check', label: '查看环境检查' },
        { key: 'frontend', label: '改为启动前端（访客 / .env.local）' },
      ],
    });

    if (!choice) return;
    if (choice.key === 'retry') return handleStartLocal({ reset });
    if (choice.key === 'check') {
      await showEnvironmentCheck();
      return handleStartLocal({ reset });
    }
    if (choice.key === 'frontend') return handleStartRemote();
  }
}

async function showEnvironmentCheck() {
  const audit = runEnvironmentAudit();
  printBlock('环境检查', formatEnvironmentAudit(audit));
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
      const confirmed = await confirmInteractive('确认重置本地数据库？所有本地数据将清空', false);
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

async function editEnvKey(key) {
  const local = parseEnvFile(ENV_LOCAL_PATH);
  const current = local.get(key) ?? '';
  const isSecret = /KEY|PASSWORD|SECRET|TOKEN/i.test(key);
  const display = isSecret ? maskSecret(current) : (current || '（空）');

  console.log('');
  console.log(key);
  console.log(`当前值: ${display}`);

  const value = await askInteractive('新值（留空保持不变，输入 - 清除）');
  if (value === '') return;
  if (value === '-') upsertEnvLocal({ [key]: undefined });
  else upsertEnvLocal({ [key]: value });
  console.log('已更新 .env.local');
}

async function handleEnvMenu() {
  const choice = await selectInteractive({
    title: '环境变量配置',
    items: [
      { key: 'create', label: '从 .env.example 创建 .env.local' },
      { key: 'qiniu_key', label: '编辑 QINIU_API_KEY（AI）' },
      { key: 'supabase_url', label: '编辑 VITE_SUPABASE_URL' },
      { key: 'supabase_anon', label: '编辑 VITE_SUPABASE_ANON_KEY' },
      { key: 'qiniu_endpoint', label: '编辑 QINIU_API_ENDPOINT' },
      { key: 'qiniu_model', label: '编辑 QINIU_MODEL' },
      { key: 'fal_key', label: '编辑 VITE_FAL_KEY' },
      { separator: '  ── 开发档案 ──' },
      { key: 'clear_dev', label: '清除 .env.development.local（恢复使用 .env.local）' },
      { key: 'list_keys', label: '查看所有可配置项' },
    ],
  });

  if (!choice) return;

  switch (choice.key) {
    case 'create': {
      const created = ensureEnvLocalFromExample();
      console.log(created ? '已创建 .env.local' : '.env.local 已存在');
      break;
    }
    case 'qiniu_key':
      await editEnvKey('QINIU_API_KEY');
      break;
    case 'supabase_url':
      await editEnvKey('VITE_SUPABASE_URL');
      break;
    case 'supabase_anon':
      await editEnvKey('VITE_SUPABASE_ANON_KEY');
      break;
    case 'qiniu_endpoint':
      await editEnvKey('QINIU_API_ENDPOINT');
      break;
    case 'qiniu_model':
      await editEnvKey('QINIU_MODEL');
      break;
    case 'fal_key':
      await editEnvKey('VITE_FAL_KEY');
      break;
    case 'clear_dev':
      unlinkDevEnv();
      console.log('已清除 .env.development.local');
      break;
    case 'list_keys':
      printBlock('可配置环境变量', listConfigurableKeys().map((k) => `  - ${k}`));
      await pauseInteractive();
      return;
    default:
      break;
  }

  if (choice.key !== 'list_keys') {
    printStatusBanner();
  }
  await pauseInteractive();
}

async function mainMenu() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    printStatusBanner();

    const choice = await selectInteractive({
      title: 'FragmentStudy 开发环境',
      allowBack: false,
      hint: '↑↓ 移动 · Enter 确认 · j/k 移动 · Esc 退出',
      items: [
        { key: 'remote', label: '启动前端（使用 .env.local / 远程 Supabase）' },
        { key: 'local', label: '启动本地 Supabase + 前端' },
        { key: 'guest', label: '启动前端（访客模式，忽略 Supabase）' },
        { separator: '  ── 工具 ──' },
        { key: 'supabase', label: 'Supabase 管理' },
        { key: 'env', label: '环境变量配置' },
        { key: 'check', label: '检查开发环境' },
        { key: 'local_reset', label: '重置本地 DB 后启动（本地 Supabase）' },
        { separator: '  ──' },
        { key: 'quit', label: '退出' },
      ],
    });

    if (!choice || choice.key === 'quit') {
      console.log('再见。');
      return;
    }

    switch (choice.key) {
      case 'remote':
        await handleStartRemote();
        return;
      case 'local':
        await handleStartLocal();
        return;
      case 'guest':
        await handleStartGuest();
        return;
      case 'supabase':
        await handleSupabaseMenu();
        break;
      case 'env':
        await handleEnvMenu();
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
  console.log('');
  console.log('FragmentStudy Dev Menu');
  console.log('方向键选择开发环境并启动');
  await mainMenu();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
