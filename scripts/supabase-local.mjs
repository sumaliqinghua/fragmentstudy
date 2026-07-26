#!/usr/bin/env node

import { ensureLocalSupabaseEnv } from './lib/ensure-local-supabase.mjs';
import { run } from './lib/run.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const [command, ...rest] = process.argv.slice(2);

function printUsage() {
  console.log(`用法:
  node scripts/supabase-local.mjs start [--reset]   启动本地 Supabase 并写入 .env.development.local
  node scripts/supabase-local.mjs status            查看状态
  node scripts/supabase-local.mjs stop              停止本地 Supabase
  node scripts/supabase-local.mjs reset             重置数据库（重新跑 migrations）
`);
}

try {
  switch (command) {
    case 'start': {
      const reset = rest.includes('--reset');
      const status = ensureLocalSupabaseEnv({ reset });
      console.log(JSON.stringify(status, null, 2));
      break;
    }
    case 'status':
      run('supabase', ['status'], { cwd: ROOT, inherit: true });
      break;
    case 'stop':
      run('supabase', ['stop'], { cwd: ROOT, inherit: true });
      break;
    case 'reset':
      run('supabase', ['db', 'reset'], { cwd: ROOT, inherit: true });
      break;
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
