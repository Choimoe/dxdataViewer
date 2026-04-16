import JSZip from 'jszip';

const COVER_BASE_URL = 'https://www.diving-fish.com/covers';
const COVER_PROXY_BASE_URL = 'https://wsrv.nl/?url=';

function parseNumericId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

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

function formatCoverId(coverId) {
  return String(coverId).padStart(5, '0');
}

function buildCoverUrl(songId) {
  const mapped = mapCoverRequestId(songId);
  return `${COVER_BASE_URL}/${formatCoverId(mapped)}.png`;
}

function buildProxyCoverUrl(songId) {
  return `${COVER_PROXY_BASE_URL}${encodeURIComponent(buildCoverUrl(songId))}`;
}

function parseIdsFromText(inputText = '') {
  const tokens = String(inputText)
    .split(/[\s,，、|｜]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const ids = [];
  tokens.forEach((token) => {
    const id = parseNumericId(token);
    if (id !== null) {
      ids.push(id);
    }
  });

  return ids;
}

async function parseIdsFromCsvText(csvText) {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default || xlsxModule;

  const workbook = XLSX.read(csvText, { type: 'string' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: false,
    blankrows: false,
    defval: '',
  });

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => String(header).trim().toLowerCase().replace(/^\ufeff/, ''));
  const idColumnIndex = headers.findIndex((header) => header === 'id');

  if (idColumnIndex === -1) {
    return [];
  }

  const ids = [];
  rows.slice(1).forEach((row) => {
    const id = parseNumericId(row[idColumnIndex]);
    if (id !== null) {
      ids.push(id);
    }
  });

  return ids;
}

function uniqueIds(ids = []) {
  return Array.from(new Set(ids));
}

async function fetchCoverBlob(songId) {
  const url = buildCoverUrl(songId);
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.blob();
  } catch (error) {
    const proxyUrl = buildProxyCoverUrl(songId);
    const proxyResponse = await fetch(proxyUrl);

    if (!proxyResponse.ok) {
      const baseMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`${baseMessage}; proxy HTTP ${proxyResponse.status}`);
    }

    return proxyResponse.blob();
  }
}

async function downloadCoversAsZip(songIds, options = {}) {
  const ids = uniqueIds(songIds);
  const total = ids.length;

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  const concurrency = Number.isInteger(options.concurrency) && options.concurrency > 0
    ? options.concurrency
    : 5;

  const zip = new JSZip();
  const failed = [];

  let currentIndex = 0;
  let completed = 0;
  let success = 0;

  onProgress({
    state: 'running',
    total,
    completed,
    success,
    failed: 0,
    currentId: null,
  });

  async function worker() {
    while (currentIndex < total) {
      const index = currentIndex;
      currentIndex += 1;

      const id = ids[index];

      try {
        // Worker 模式下按序领取任务，循环内等待属于预期行为。
        // eslint-disable-next-line no-await-in-loop
        const blob = await fetchCoverBlob(id);
        zip.file(`${id}.png`, blob);
        success += 1;
      } catch (error) {
        failed.push({
          id,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        completed += 1;
        onProgress({
          state: 'running',
          total,
          completed,
          success,
          failed: failed.length,
          currentId: id,
        });
      }
    }
  }

  if (total === 0) {
    return {
      blob: null,
      total,
      success,
      failed,
    };
  }

  const workerCount = Math.min(concurrency, total);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const blob = await zip.generateAsync({ type: 'blob' });

  onProgress({
    state: 'done',
    total,
    completed,
    success,
    failed: failed.length,
    currentId: null,
  });

  return {
    blob,
    total,
    success,
    failed,
  };
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function useCoverDownloader() {
  return {
    parseIdsFromText,
    parseIdsFromCsvText,
    uniqueIds,
    downloadCoversAsZip,
    triggerBlobDownload,
    mapCoverRequestId,
    buildCoverUrl,
    buildProxyCoverUrl,
  };
}
