import { commandExists, run } from './run.mjs';
import { ROOT } from './env-files.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.join(ROOT, 'supabase', 'config.toml');

export function checkDockerInstalled() {
  return commandExists('docker');
}

export function checkDockerRunning() {
  if (!checkDockerInstalled()) return false;
  try {
    run('docker', ['info'], { cwd: ROOT });
    return true;
  } catch {
    return false;
  }
}

export function checkSupabaseCli() {
  return commandExists('supabase');
}

export function checkSupabaseConfig() {
  return existsSync(CONFIG_PATH);
}

export function runEnvironmentAudit() {
  return {
    node: process.version,
    dockerInstalled: checkDockerInstalled(),
    dockerRunning: checkDockerRunning(),
    supabaseCli: checkSupabaseCli(),
    supabaseConfig: checkSupabaseConfig(),
  };
}

export function formatEnvironmentAudit(audit) {
  const line = (ok, label, detail = '') =>
    `  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`;

  return [
    line(true, 'Node.js', audit.node),
    line(audit.dockerInstalled, 'Docker 已安装'),
    line(audit.dockerRunning, 'Docker 正在运行'),
    line(audit.supabaseCli, 'Supabase CLI 已安装'),
    line(audit.supabaseConfig, 'supabase/config.toml 存在'),
  ];
}

export function getLocalSupabaseSetupGuide(errorMessage = '') {
  const lines = [
    '本地 Supabase 需要以下环境：',
    '',
    '1. 安装 Docker Desktop',
    '   https://docs.docker.com/get-docker/',
    '   安装后启动 Docker，等待状态栏图标显示 Running',
    '',
    '2. 安装 Supabase CLI（macOS）',
    '   brew install supabase/tap/supabase',
    '   文档: https://supabase.com/docs/guides/cli',
    '',
    '3. 确认项目包含 supabase/config.toml 与 supabase/migrations/',
    '',
    '4. 回到菜单选择「启动本地 Supabase + 前端」',
    '   首次启动会拉取镜像，可能需要几分钟',
    '',
    '常用地址（启动成功后）：',
    '   Studio:  http://127.0.0.1:54323',
    '   API:     http://127.0.0.1:54321',
    '   邮件:    http://127.0.0.1:54324',
  ];

  if (errorMessage) {
    lines.unshift(`失败原因: ${errorMessage}`, '');
  }

  return lines;
}
