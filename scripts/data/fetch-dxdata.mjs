import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const SOURCE_NAME = 'dxdata';
const SOURCE_URL = 'https://raw.githubusercontent.com/gekichumai/dxrating/refs/heads/main/packages/dxdata/dxdata.json';

const ROOT_DIR = resolve(process.cwd());
const RAW_DIR = resolve(ROOT_DIR, 'data', 'raw', SOURCE_NAME);
const CSV_DIR = resolve(ROOT_DIR, 'data', 'csv', SOURCE_NAME);
const JSON_PATH = resolve(RAW_DIR, 'dxdata.json');

const FETCH_RETRIES = Number(process.env.DXDATA_FETCH_RETRIES ?? 8);
const FETCH_TIMEOUT_MS = Number(process.env.DXDATA_FETCH_TIMEOUT_MS ?? 600000);
const FETCH_BACKOFF_MS = Number(process.env.DXDATA_FETCH_BACKOFF_MS ?? 2000);
const USE_CURL_FALLBACK = process.env.DXDATA_USE_CURL_FALLBACK !== '0';
const SKIP_DOWNLOAD = process.env.DXDATA_SKIP_DOWNLOAD === '1';
const ALLOW_STALE_JSON = process.env.DXDATA_ALLOW_STALE_JSON !== '0';

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
    '6',
    '--retry-delay',
    '3',
    '--connect-timeout',
    '30',
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

function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function toCsv(rows, headers) {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const bodyLines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

function buildSongsCsvRows(data) {
  const songs = Array.isArray(data.songs) ? data.songs : [];

  return songs.flatMap((song) => {
    const songBase = {
      songId: song.songId ?? song.id ?? '',
      title: song.title ?? song.name ?? '',
      artist: song.artist ?? '',
      bpm: song.bpm ?? '',
      category: song.category ?? song.genre ?? '',
      imageName: song.imageName ?? song.dimg ?? song.nimg ?? '',
      isNew: song.isNew ?? '',
      isLocked: song.isLocked ?? '',
      searchAcronyms: Array.isArray(song.searchAcronyms) ? song.searchAcronyms.join('|') : '',
    };

    const sheets = Array.isArray(song.sheets) ? song.sheets : [];
    if (sheets.length === 0) {
      return [{ ...songBase }];
    }

    return sheets.map((sheet) => ({
      ...songBase,
      sheetType: sheet.type ?? '',
      difficulty: sheet.difficulty ?? '',
      level: sheet.level ?? '',
      internalLevelValue: sheet.internalLevelValue ?? sheet.level ?? '',
      noteDesigner: sheet.noteDesigner ?? sheet.charter ?? '',
      noteTap: sheet.noteCounts?.tap ?? sheet.notes?.[0] ?? '',
      noteHold: sheet.noteCounts?.hold ?? sheet.notes?.[1] ?? '',
      noteSlide: sheet.noteCounts?.slide ?? sheet.notes?.[2] ?? '',
      noteTouch: sheet.noteCounts?.touch ?? sheet.notes?.[4] ?? '',
      noteBreak: sheet.noteCounts?.break ?? sheet.notes?.[3] ?? '',
      noteTotal: sheet.noteCounts?.total ?? '',
      regionJp: sheet.regions?.jp ?? '',
      regionIntl: sheet.regions?.intl ?? '',
      regionUsa: sheet.regions?.usa ?? '',
      regionCn: sheet.regions?.cn ?? '',
      isSpecial: sheet.isSpecial ?? '',
      version: sheet.version ?? song.version ?? '',
      internalId: sheet.internalId ?? song.id ?? '',
      releaseDate: sheet.releaseDate ?? song.date ?? '',
    }));
  });
}

function mapArrayTable(records, fieldMap) {
  const source = Array.isArray(records) ? records : [];
  return source.map((item) => {
    const row = {};
    for (const [column, resolver] of Object.entries(fieldMap)) {
      row[column] = resolver(item);
    }
    return row;
  });
}

async function writeCsv(fileName, rows, headers) {
  const filePath = resolve(CSV_DIR, fileName);
  const csvText = toCsv(rows, headers);
  await writeFile(filePath, `${csvText}\n`, 'utf8');
  return filePath;
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(CSV_DIR, { recursive: true });

  let json;

  if (SKIP_DOWNLOAD) {
    if (!(await fileExists(JSON_PATH))) {
      throw new Error(`DXDATA_SKIP_DOWNLOAD=1 but local file not found: ${JSON_PATH}`);
    }
    const localText = await readFile(JSON_PATH, 'utf8');
    json = JSON.parse(localText);
    console.log('Skip download enabled, reusing local JSON.');
  }
  else {
    try {
      json = await fetchJsonWithRetry(SOURCE_URL, FETCH_RETRIES, FETCH_TIMEOUT_MS);
      await writeFile(JSON_PATH, `${JSON.stringify(json)}\n`, 'utf8');
      console.log('Downloaded JSON via fetch.');
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

  const songsRows = buildSongsCsvRows(json);
  await writeCsv('songs.csv', songsRows, [
    'songId',
    'title',
    'artist',
    'bpm',
    'category',
    'imageName',
    'isNew',
    'isLocked',
    'searchAcronyms',
    'sheetType',
    'difficulty',
    'level',
    'internalLevelValue',
    'noteDesigner',
    'noteTap',
    'noteHold',
    'noteSlide',
    'noteTouch',
    'noteBreak',
    'noteTotal',
    'regionJp',
    'regionIntl',
    'regionUsa',
    'regionCn',
    'isSpecial',
    'version',
    'internalId',
    'releaseDate',
  ]);

  const categoriesRows = mapArrayTable(json.categories, {
    category: (item) => item.category ?? item.cn ?? item.jp ?? item.intl ?? '',
  });
  await writeCsv('categories.csv', categoriesRows, ['category']);

  const versionsRows = mapArrayTable(json.versions, {
    version: (item) => item.version ?? '',
    abbr: (item) => item.abbr ?? '',
    releaseDate: (item) => item.releaseDate ?? '',
  });
  await writeCsv('versions.csv', versionsRows, ['version', 'abbr', 'releaseDate']);

  const typesRows = mapArrayTable(json.types, {
    type: (item) => item.type ?? '',
    name: (item) => item.name ?? '',
    abbr: (item) => item.abbr ?? '',
    iconUrl: (item) => item.iconUrl ?? '',
    iconHeight: (item) => item.iconHeight ?? '',
  });
  await writeCsv('types.csv', typesRows, ['type', 'name', 'abbr', 'iconUrl', 'iconHeight']);

  const difficultiesRows = mapArrayTable(json.difficulties, {
    difficulty: (item) => item.difficulty ?? '',
    name: (item) => item.name ?? '',
    color: (item) => item.color ?? '',
  });
  await writeCsv('difficulties.csv', difficultiesRows, ['difficulty', 'name', 'color']);

  const regionsRows = mapArrayTable(json.regions, {
    region: (item) => item.region ?? item.code ?? item.name ?? '',
    name: (item) => item.name ?? '',
  });
  await writeCsv('regions.csv', regionsRows, ['region', 'name']);

  let updateTimeRows = [];
  let updateTimeHeaders = [];

  if (json.updateTime && typeof json.updateTime === 'object' && !Array.isArray(json.updateTime)) {
    updateTimeRows = [json.updateTime];
    updateTimeHeaders = Object.keys(json.updateTime);
  }
  else if (json.updateTime !== undefined && json.updateTime !== null) {
    updateTimeRows = [{ updateTime: json.updateTime }];
    updateTimeHeaders = ['updateTime'];
  }

  if (updateTimeHeaders.length > 0) {
    await writeCsv('update_time.csv', updateTimeRows, updateTimeHeaders);
  }

  console.log('dxdata saved:');
  console.log(`- JSON: ${JSON_PATH}`);
  console.log(`- CSV dir: ${CSV_DIR}`);
  console.log(`- songs rows: ${songsRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
