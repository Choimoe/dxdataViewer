import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import xlsx from 'xlsx';

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

function parseIdsFromTokens(tokens) {
  const ids = tokens
    .join(',')
    .split(/[\s,，、|｜]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((token) => parseNumericId(token))
    .filter((id) => id !== null);

  return Array.from(new Set(ids));
}

function normalizeHeader(header) {
  return String(header ?? '').trim().toLowerCase().replace(/^\ufeff/, '');
}

function parseCliOptions(argv) {
  const options = {
    csvPath: null,
    idColumn: null,
    idTokens: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--csv') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --csv');
      }
      options.csvPath = resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (token === '--id-column') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('Missing value for --id-column');
      }
      options.idColumn = normalizeHeader(next);
      index += 1;
      continue;
    }

    if (token === '--help' || token === '-h') {
      console.log('Usage: pnpm run data:download:covers -- [ids...] [--csv <file>] [--id-column <name>]');
      console.log('Examples:');
      console.log('  pnpm run data:download:covers');
      console.log('  pnpm run data:download:covers -- 22 47 70');
      console.log('  pnpm run data:download:covers -- --csv ./ids.csv');
      console.log('  pnpm run data:download:covers -- --csv ./ids.csv --id-column ID');
      process.exit(0);
    }

    options.idTokens.push(token);
  }

  return options;
}

async function parseIdsFromCsvFile(csvPath, preferredIdColumn) {
  const workbook = xlsx.readFile(csvPath, { raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: false,
    blankrows: false,
    defval: '',
  });

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const candidates = preferredIdColumn
    ? [preferredIdColumn]
    : ['id', 'songid', 'song_id'];

  const columnIndex = candidates
    .map((name) => headers.findIndex((header) => header === name))
    .find((index) => index !== -1);

  if (columnIndex === undefined || columnIndex === -1) {
    throw new Error(`ID column not found in CSV. Tried: ${candidates.join(', ')}`);
  }

  const ids = rows
    .slice(1)
    .map((row) => parseNumericId(row[columnIndex]))
    .filter((id) => id !== null);

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
  const options = parseCliOptions(process.argv.slice(2));
  const idsFromArgs = parseIdsFromTokens(options.idTokens);
  const idsFromCsv = options.csvPath
    ? await parseIdsFromCsvFile(options.csvPath, options.idColumn)
    : [];

  let ids = Array.from(new Set([...idsFromCsv, ...idsFromArgs]));
  if (ids.length === 0) {
    ids = [...DEFAULT_IDS];
  }

  if (options.csvPath && idsFromCsv.length === 0) {
    throw new Error(`No valid IDs found in CSV: ${options.csvPath}`);
  }

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
