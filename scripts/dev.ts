import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn(process.execPath, [resolve(root, 'node_modules/@nestjs/cli/bin/nest.js'), 'start', '--builder', 'tsc', '--watch'], { cwd: resolve(root, 'apps/api'), stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js')], { cwd: resolve(root, 'apps/web'), stdio: 'inherit', windowsHide: true }),
];

let stopping = false;
function stop(code = 0): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else child.kill();
  }
  process.exitCode = code;
}

for (const child of children) {
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => stop(code ?? 1));
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
