import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const SOURCE_NAME = 'maichart';
const SOURCE_URL = 'https://github.com/Neskol/Maichart-Converts/raw/refs/heads/master/index.json';

const ROOT_DIR = resolve(process.cwd());
const RAW_DIR = resolve(ROOT_DIR, 'data', 'raw', SOURCE_NAME);
const JSON_PATH = resolve(RAW_DIR, 'index.json');

const FETCH_RETRIES = Number(process.env.MAICHART_FETCH_RETRIES ?? 5);
const FETCH_TIMEOUT_MS = Number(process.env.MAICHART_FETCH_TIMEOUT_MS ?? 180000);
const FETCH_BACKOFF_MS = Number(process.env.MAICHART_FETCH_BACKOFF_MS ?? 2000);
const USE_CURL_FALLBACK = process.env.MAICHART_USE_CURL_FALLBACK !== '0';
const SKIP_DOWNLOAD = process.env.MAICHART_SKIP_DOWNLOAD === '1';
const ALLOW_STALE_JSON = process.env.MAICHART_ALLOW_STALE_JSON !== '0';

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  }
  catch {
    return false;
  }
}

async function fetchJsonWithRetry(url, retries = FETCH_RETRIES, timeoutMs = FETCH_TIMEOUT_MS) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}, status=${response.status}`);
      }
      return await response.json();
    }
    catch (error) {
      if (attempt === retries) {
        throw error;
      }
      const waitMs = FETCH_BACKOFF_MS * (2 ** (attempt - 1));
      console.warn(`Fetch failed (attempt ${attempt}/${retries}), retrying in ${waitMs}ms...`);
      await sleep(waitMs);
    }
    finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Unexpected fetch retry state');
}

async function runCurlDownload(url, outputPath, timeoutMs = FETCH_TIMEOUT_MS) {
  const maxTimeSec = Math.ceil(timeoutMs / 1000);
  const args = [
    '-L',
    '--fail',
    '--retry',
    '5',
    '--retry-delay',
    '2',
    '--connect-timeout',
    '20',
    '--max-time',
    String(maxTimeSec),
    '-o',
    outputPath,
    url,
  ];

  await new Promise((resolveRun, rejectRun) => {
    const child = spawn('curl', args, { stdio: 'inherit' });
    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(new Error(`curl exited with code ${code ?? 'unknown'}`));
    });
  });

  const rawText = await readFile(outputPath, 'utf8');
  return JSON.parse(rawText);
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });

  let json;

  if (SKIP_DOWNLOAD) {
    if (!(await fileExists(JSON_PATH))) {
      throw new Error(`MAICHART_SKIP_DOWNLOAD=1 but local file not found: ${JSON_PATH}`);
    }
    const localText = await readFile(JSON_PATH, 'utf8');
    json = JSON.parse(localText);
    console.log('Skip download enabled, reusing local JSON.');
  }
  else {
    try {
      json = await fetchJsonWithRetry(SOURCE_URL, FETCH_RETRIES, FETCH_TIMEOUT_MS);
      await writeFile(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
      console.log('Downloaded Maichart mapping via fetch.');
    }
    catch (error) {
      console.warn(`Fetch download failed: ${error?.message ?? error}`);

      if (USE_CURL_FALLBACK) {
        console.log('Trying curl fallback download...');
        json = await runCurlDownload(SOURCE_URL, JSON_PATH, FETCH_TIMEOUT_MS);
      }
      else if (ALLOW_STALE_JSON && await fileExists(JSON_PATH)) {
        console.warn('Using stale local JSON because download failed and fallback is disabled.');
        const localText = await readFile(JSON_PATH, 'utf8');
        json = JSON.parse(localText);
      }
      else {
        throw error;
      }
    }
  }

  console.log('maichart saved:');
  console.log(`- JSON: ${JSON_PATH}`);
  console.log(`- entries: ${Array.isArray(json) ? json.length : Object.keys(json ?? {}).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});