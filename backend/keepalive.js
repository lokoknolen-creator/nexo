// ============================================================
// NEXORA 24/7 keeper — restarts server.js automatically if it
// crashes, and schedules it to start at boot (Windows only).
//
//   node keepalive.js          → run/restart the server forever
//   node keepalive.js --install→ add a Windows Scheduled Task
//                                that launches the keeper at logon
//   node keepalive.js --uninstall
// ============================================================
const { spawn } = require('child_process');
const path = require('path');

const SERVER = path.join(__dirname, 'server.js');
const TASK_NAME = 'NexoraBackend24x7';

let child = null;
let restarting = false;

function log(msg) { console.log('[keepalive ' + new Date().toLocaleTimeString() + '] ' + msg); }

function start() {
  log('Starting server.js...');
  child = spawn(process.execPath, [SERVER], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', function (code, signal) {
    if (restarting) return;
    log('server.js exited (code=' + code + ' signal=' + signal + ') — restarting in 2s');
    setTimeout(start, 2000);
  });
}

function shutdown() {
  restarting = true;
  log('Shutting down keeper and server...');
  if (child && child.exitCode === null) child.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', function (e) { log('keeper error: ' + e.message); });

if (process.argv.includes('--install')) {
  if (process.platform !== 'win32') { console.error('--install is Windows-only'); process.exit(1); }
  const cmd = 'schtasks /Create /F /TN "' + TASK_NAME + '" /SC ONLOGON /RL HIGHEST /TR "' +
    process.execPath + ' \\"' + path.join(__dirname, 'keepalive.js') + '\\""';
  require('child_process').exec(cmd, function (err) {
    if (err) { console.error('Failed to create scheduled task:', err.message); process.exit(1); }
    log('Scheduled task "' + TASK_NAME + '" created. The backend will start at every logon.');
    start();
  });
} else if (process.argv.includes('--uninstall')) {
  if (process.platform !== 'win32') { console.error('--uninstall is Windows-only'); process.exit(1); }
  require('child_process').exec('schtasks /Delete /F /TN "' + TASK_NAME + '"', function (err) {
    if (err) console.error('Failed to delete task:', err.message);
    else log('Scheduled task "' + TASK_NAME + '" removed.');
  });
} else {
  start();
}
