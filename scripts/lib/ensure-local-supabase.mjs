import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandExists, run } from './run.mjs';
import { applyDevProfile, DEV_PROFILES, ROOT } from './env-files.mjs';

const CONFIG_PATH = path.join(ROOT, 'supabase', 'config.toml');

export function assertPrerequisites() {
  if (!commandExists('docker')) {
    throw new Error(
      '未找到 Docker。本地 Supabase 需要 Docker Desktop：\n' +
      '  https://docs.docker.com/get-docker/'
    );
  }

  try {
    run('docker', ['info'], { cwd: ROOT });
  } catch {
    throw new Error(
      'Docker 未运行。请先启动 Docker Desktop，再重试。'
    );
  }

  if (!commandExists('supabase')) {
    throw new Error(
      '未找到 Supabase CLI。安装方式（macOS）：\n' +
      '  brew install supabase/tap/supabase\n' +
      '文档：https://supabase.com/docs/guides/cli'
    );
  }

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      '缺少 supabase/config.toml。请确认仓库已包含该文件，或运行：supabase init'
    );
  }
}

export function startLocalSupabase({ reset = false } = {}) {
  assertPrerequisites();

  if (reset) {
    console.log('↻ 重置本地数据库并重新应用 migrations...');
    run('supabase', ['db', 'reset'], { cwd: ROOT, inherit: true });
    return readSupabaseStatus();
  }

  console.log('▶ 启动本地 Supabase（首次启动会拉取 Docker 镜像，可能需要几分钟）...');
  run('supabase', ['start'], { cwd: ROOT, inherit: true });
  return readSupabaseStatus();
}

export function readSupabaseStatus() {
  const output = run('supabase', ['status', '-o', 'json'], { cwd: ROOT });
  const status = JSON.parse(output);

  const apiUrl = status.API_URL;
  const anonKey = status.ANON_KEY;

  if (!apiUrl || !anonKey) {
    throw new Error('无法从 `supabase status` 读取 API_URL / ANON_KEY');
  }

  return {
    apiUrl,
    anonKey,
    studioUrl: status.STUDIO_URL,
    dbUrl: status.DB_URL,
    inbucketUrl: status.INBUCKET_URL,
  };
}

export function ensureLocalSupabaseEnv(options = {}) {
  const status = startLocalSupabase(options);
  applyDevProfile(DEV_PROFILES.LOCAL_SUPABASE, status);
  return status;
}
