import { spawn, spawnSync } from 'node:child_process';

export function commandExists(command) {
  const result = spawnSync('sh', ['-c', `command -v ${command}`], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.inherit ? 'inherit' : 'pipe',
    encoding: 'utf8',
    cwd: options.cwd,
    env: options.env ?? process.env,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const detail = stderr || stdout || `exit code ${result.status}`;
    throw new Error(`${command} ${args.join(' ')} failed: ${detail}`);
  }

  return result.stdout ?? '';
}

export function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    cwd: options.cwd,
    env: options.env ?? process.env,
    shell: options.shell ?? false,
  });
}
