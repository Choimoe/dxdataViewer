import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const SOURCE_NAME = 'diving-fish';
const SOURCE_URL = 'https://www.diving-fish.com/api/maimaidxprober/music_data';

const ROOT_DIR = resolve(process.cwd());
const RAW_DIR = resolve(ROOT_DIR, 'data', 'raw', SOURCE_NAME);
const CSV_DIR = resolve(ROOT_DIR, 'data', 'csv', SOURCE_NAME);
const JSON_PATH = resolve(RAW_DIR, 'music_data.json');

const FETCH_RETRIES = Number(process.env.DIVING_FISH_FETCH_RETRIES ?? 5);
const FETCH_TIMEOUT_MS = Number(process.env.DIVING_FISH_FETCH_TIMEOUT_MS ?? 180000);
const FETCH_BACKOFF_MS = Number(process.env.DIVING_FISH_FETCH_BACKOFF_MS ?? 2000);
const USE_CURL_FALLBACK = process.env.DIVING_FISH_USE_CURL_FALLBACK !== '0';
const SKIP_DOWNLOAD = process.env.DIVING_FISH_SKIP_DOWNLOAD === '1';
const ALLOW_STALE_JSON = process.env.DIVING_FISH_ALLOW_STALE_JSON !== '0';

const DIFFICULTY_LABELS = ['basic', 'advanced', 'expert', 'master', 'remaster'];

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

function toSheetType(type) {
  const upper = String(type || '').toUpperCase();
  if (upper === 'DX') {
    return 'dx';
  }
  if (upper === 'SD') {
    return 'std';
  }
  return String(type || '').toLowerCase();
}

function buildSongsCsvRows(musicData) {
  const songs = Array.isArray(musicData) ? musicData : [];

  return songs.flatMap((song) => {
    const levels = Array.isArray(song.level) ? song.level : [];
    const dsList = Array.isArray(song.ds) ? song.ds : [];
    const charts = Array.isArray(song.charts) ? song.charts : [];
    const sheetType = toSheetType(song.type);

    const rowCount = Math.max(levels.length, dsList.length, charts.length);

    return Array.from({ length: rowCount }, (_, idx) => {
      const chart = charts[idx] || {};
      const notes = Array.isArray(chart.notes) ? chart.notes : [];
      const hasTouch = notes.length >= 5;

      const tap = notes[0] ?? '';
      const hold = notes[1] ?? '';
      const slide = notes[2] ?? '';
      const touch = hasTouch ? notes[3] : '';
      const breakNote = hasTouch ? notes[4] : (notes[3] ?? '');

      const noteTotal = notes
        .filter((value) => Number.isFinite(Number(value)))
        .reduce((sum, value) => sum + Number(value), 0);

      return {
        songId: song.id ?? '',
        title: song.title ?? '',
        artist: song.basic_info?.artist ?? '',
        bpm: song.basic_info?.bpm ?? '',
        category: song.basic_info?.genre ?? '',
        imageName: '',
        isNew: song.basic_info?.is_new ?? '',
        isLocked: '',
        searchAcronyms: '',
        sheetType,
        difficulty: DIFFICULTY_LABELS[idx] ?? `difficulty-${idx}`,
        level: levels[idx] ?? '',
        internalLevelValue: dsList[idx] ?? '',
        noteDesigner: chart.charter ?? '',
        noteTap: tap,
        noteHold: hold,
        noteSlide: slide,
        noteTouch: touch,
        noteBreak: breakNote,
        noteTotal: noteTotal || '',
        regionJp: '',
        regionIntl: '',
        regionUsa: '',
        regionCn: '',
        isSpecial: '',
        version: song.basic_info?.from ?? '',
        internalId: song.id ?? '',
        releaseDate: song.basic_info?.release_date ?? '',
      };
    });
  });
}

function buildVersionsCsvRows(musicData) {
  const songs = Array.isArray(musicData) ? musicData : [];
  const versionMap = new Map();

  songs.forEach((song) => {
    const versionName = song.basic_info?.from;
    if (!versionName) {
      return;
    }

    if (!versionMap.has(versionName)) {
      versionMap.set(versionName, {
        version: versionName,
        abbr: '',
        releaseDate: song.basic_info?.release_date ?? '',
      });
    }
  });

  return [...versionMap.values()];
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
      throw new Error(`DIVING_FISH_SKIP_DOWNLOAD=1 but local file not found: ${JSON_PATH}`);
    }
    const localText = await readFile(JSON_PATH, 'utf8');
    json = JSON.parse(localText);
    console.log('Skip download enabled, reusing local JSON.');
  }
  else {
    try {
      json = await fetchJsonWithRetry(SOURCE_URL, FETCH_RETRIES, FETCH_TIMEOUT_MS);
      await writeFile(JSON_PATH, `${JSON.stringify(json)}\n`, 'utf8');
      console.log('Downloaded Diving-Fish music data via fetch.');
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
  const versionsRows = buildVersionsCsvRows(json);

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

  await writeCsv('versions.csv', versionsRows, ['version', 'abbr', 'releaseDate']);

  console.log('diving-fish saved:');
  console.log(`- JSON: ${JSON_PATH}`);
  console.log(`- CSV dir: ${CSV_DIR}`);
  console.log(`- songs rows: ${songsRows.length}`);
  console.log(`- versions rows: ${versionsRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
