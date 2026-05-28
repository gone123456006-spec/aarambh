/**
 * Frees a TCP port before starting dev server (fixes EADDRINUSE on Windows).
 * Usage: node scripts/free-port.js [port]
 */
const { execSync, spawnSync } = require('child_process');

const port = process.argv[2] || process.env.PORT || '5000';

function getListeningPidsWin(targetPort) {
  let out = '';
  try {
    out = execSync(`netstat -ano | findstr :${targetPort}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return [];
  }

  const pids = new Set();
  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid) && pid !== '0') {
      pids.add(pid);
    }
  }
  return [...pids];
}

function getProcessNameWin(pid) {
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const match = out.match(/"([^"]+)"/);
    return match ? match[1].toLowerCase() : '';
  } catch {
    return '';
  }
}

function freePortWin(targetPort) {
  const pids = getListeningPidsWin(targetPort);

  if (pids.length === 0) {
    console.log(`[free-port] Port ${targetPort} is free.`);
    return;
  }

  const currentPid = String(process.pid);

  for (const pid of pids) {
    if (pid === currentPid) continue;

    const name = getProcessNameWin(pid);
    // Only stop Node processes (stale backend), not random system services
    if (name && !name.includes('node.exe')) {
      console.warn(
        `[free-port] Port ${targetPort} is used by ${name} (PID ${pid}) — not killed.`
      );
      continue;
    }

    console.log(`[free-port] Stopping stale node PID ${pid} on port ${targetPort}...`);
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    } catch {
      console.warn(`[free-port] Could not stop PID ${pid}`);
    }
  }

  console.log(`[free-port] Port ${targetPort} ready.`);
}

function freePortUnix(targetPort) {
  try {
    const result = spawnSync('sh', ['-c', `lsof -ti :${targetPort} | xargs -r kill -9`], {
      stdio: 'inherit',
    });
    if (result.status === 0) {
      console.log(`[free-port] Port ${targetPort} cleared.`);
    } else {
      console.log(`[free-port] Port ${targetPort} is free.`);
    }
  } catch {
    console.log(`[free-port] Port ${targetPort} is free.`);
  }
}

if (process.platform === 'win32') {
  freePortWin(port);
} else {
  freePortUnix(port);
}
