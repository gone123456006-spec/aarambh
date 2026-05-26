/**
 * Frees a TCP port on Windows (kills LISTENING process). Usage: node scripts/free-port.js 5000
 */
const { execSync } = require('child_process');

const port = process.argv[2] || '5000';

function freePortWin(targetPort) {
  let out = '';
  try {
    out = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
  } catch {
    console.log(`[free-port] Port ${targetPort} is already free.`);
    return;
  }

  const pids = new Set();
  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }

  if (pids.size === 0) {
    console.log(`[free-port] Port ${targetPort} is already free.`);
    return;
  }

  for (const pid of pids) {
    console.log(`[free-port] Stopping PID ${pid} on port ${targetPort}...`);
    execSync(`taskkill /PID ${pid} /F`);
  }
  console.log(`[free-port] Port ${targetPort} is free.`);
}

if (process.platform !== 'win32') {
  console.warn('[free-port] This script targets Windows. On Mac/Linux use: lsof -ti :' + port);
  process.exit(1);
}

freePortWin(port);
