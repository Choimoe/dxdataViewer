import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const COVER_BASE_URL = 'https://www.diving-fish.com/covers';
const DEFAULT_IDS = [22, 47, 70, 11222, 11901];
const OUTPUT_DIR = resolve(process.cwd(), 'data', 'raw', 'diving-fish', 'covers');

const FETCH_TIMEOUT_MS = Number(process.env.COVER_FETCH_TIMEOUT_MS ?? 20000);
const CONCURRENCY = Number(process.env.COVER_FETCH_CONCURRENCY ?? 5);

function parseNumericId(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }

  const num = Number(text);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }

  return Math.trunc(num);
}

function mapCoverRequestId(songId) {
  if (songId > 10000 && songId <= 11000) {
    return songId - 10000;
  }
  return songId;
}

function formatCoverId(songId) {
  return String(mapCoverRequestId(songId)).padStart(5, '0');
}

function buildCoverUrl(songId) {
  return `${COVER_BASE_URL}/${formatCoverId(songId)}.png`;
}

function parseIdsFromArgv(argv) {
  if (argv.length === 0) {
    return [...DEFAULT_IDS];
  }

  const tokens = argv
    .join(',')
    .split(/[\s,，、|｜]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const ids = tokens
    .map((token) => parseNumericId(token))
    .filter((id) => id !== null);

  if (ids.length === 0) {
    return [...DEFAULT_IDS];
  }

  return Array.from(new Set(ids));
}

async function fetchCover(songId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = buildCoverUrl(songId);
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const ids = parseIdsFromArgv(process.argv.slice(2));
  const success = [];
  const failed = [];

  await mkdir(OUTPUT_DIR, { recursive: true });

  let currentIndex = 0;

  async function worker() {
    while (currentIndex < ids.length) {
      const index = currentIndex;
      currentIndex += 1;

      const songId = ids[index];
      const outputPath = resolve(OUTPUT_DIR, `${songId}.png`);

      try {
        // eslint-disable-next-line no-await-in-loop
        const buffer = await fetchCover(songId);
        // eslint-disable-next-line no-await-in-loop
        await writeFile(outputPath, buffer);
        success.push(songId);
        console.log(`OK ${songId} -> ${outputPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        failed.push({ id: songId, message });
        console.log(`FAIL ${songId}: ${message}`);
      }
    }
  }

  const workerCount = Math.max(1, Math.min(CONCURRENCY, ids.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  console.log('');
  console.log('=== Batch Cover Download Summary ===');
  console.log(`outputDir: ${OUTPUT_DIR}`);
  console.log(`total: ${ids.length}`);
  console.log(`success: ${success.length}`);
  console.log(`failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('failedItems:');
    failed.forEach((item) => {
      console.log(`- ${item.id}: ${item.message}`);
    });

    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
