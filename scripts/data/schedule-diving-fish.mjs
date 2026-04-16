import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(process.cwd());
const FETCH_SCRIPT = resolve(ROOT_DIR, 'scripts', 'data', 'fetch-diving-fish.mjs');
const UPDATE_INTERVAL_MS = Number(process.env.DIVING_FISH_UPDATE_INTERVAL_MS ?? 21600000);

let timer = null;
let running = false;

function runFetch() {
  if (running) {
    console.log('Previous update is still running, skip this tick.');
    return;
  }

  running = true;
  console.log(`[${new Date().toISOString()}] Start diving-fish update...`);

  const child = spawn('node', [FETCH_SCRIPT], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('close', (code) => {
    running = false;

    if (code === 0) {
      console.log(`[${new Date().toISOString()}] Update finished.`);
      return;
    }

    console.error(`[${new Date().toISOString()}] Update failed with code ${code ?? 'unknown'}.`);
  });
}

function start() {
  if (!Number.isFinite(UPDATE_INTERVAL_MS) || UPDATE_INTERVAL_MS < 60000) {
    throw new Error('DIVING_FISH_UPDATE_INTERVAL_MS must be >= 60000');
  }

  console.log(`Diving-Fish schedule started. Interval: ${UPDATE_INTERVAL_MS}ms`);
  runFetch();
  timer = setInterval(runFetch, UPDATE_INTERVAL_MS);
}

function shutdown(signal) {
  if (timer) {
    clearInterval(timer);
  }
  console.log(`\nReceived ${signal}, scheduler stopped.`);
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
