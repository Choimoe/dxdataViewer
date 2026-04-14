import { computed, ref, watch } from 'vue';
// eslint-disable-next-line import/no-unresolved
import songsCsvRaw from '../../data/csv/dxdata/songs.csv?raw';
// eslint-disable-next-line import/no-unresolved
import versionsCsvRaw from '../../data/csv/dxdata/versions.csv?raw';

const difficultyOrder = {
  basic: 1,
  advanced: 2,
  expert: 3,
  master: 4,
  remaster: 5,
};

export const songsTableColumns = [
  { key: 'internalId', label: 'ID' },
  { key: 'title', label: '乐曲' },
  { key: 'artist', label: '艺术家' },
  { key: 'sheetType', label: '类型' },
  { key: 'difficulty', label: '难度' },
  { key: 'level', label: '等级' },
  { key: 'internalLevelValue', label: '难度定数' },
  { key: 'noteDesigner', label: '谱师' },
  { key: 'noteBreak', label: 'Break' },
  { key: 'category', label: '分类' },
  { key: 'version', label: '版本' },
  { key: 'releaseDate', label: '追加日期' },
];

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  values.push(current);
  return values;
}

function parseSongsCsv(text) {
  const lines = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line, idx) => {
    const row = parseCsvLine(line);
    const item = {};

    headers.forEach((header, headerIdx) => {
      item[header] = row[headerIdx] ?? '';
    });

    return {
      ...item,
      _rowId: `${item.internalId || item.songId || idx}-${item.sheetType || 'na'}-${item.difficulty || 'na'}-${idx}`,
      levelNum: Number(item.level) || 0,
      internalLevelNum: Number(item.internalLevelValue) || 0,
      noteBreakNum: Number(item.noteBreak) || 0,
      difficultyRank: difficultyOrder[item.difficulty] || 999,
    };
  });
}

function parseVersionsOrder(text) {
  const lines = text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const versionIndex = headers.indexOf('version');

  if (versionIndex === -1) {
    return [];
  }

  return lines.slice(1)
    .map((line) => parseCsvLine(line)[versionIndex] || '')
    .filter(Boolean);
}

function getLevelSortValue(levelText) {
  const text = String(levelText || '').trim();
  const match = text.match(/^(\d+)(\+)?$/u);

  if (match) {
    return (Number(match[1]) * 2) + (match[2] ? 1 : 0);
  }

  const parsed = Number(text);
  if (!Number.isNaN(parsed)) {
    return parsed * 2;
  }

  return Number.POSITIVE_INFINITY;
}

function compareValue(song, key) {
  if (key === 'internalId') {
    return Number(song.internalId) || 0;
  }

  if (key === 'difficulty') {
    return song.difficultyRank;
  }

  if (key === 'internalLevelValue') {
    return song.internalLevelNum;
  }

  if (key === 'noteBreak') {
    return song.noteBreakNum;
  }

  if (key === 'level') {
    return song.levelNum;
  }

  return song[key] ?? '';
}

export default function useSongsTable() {
  const keyword = ref('');
  const difficulty = ref('');
  const level = ref('');
  const minInternalLevel = ref('');
  const maxInternalLevel = ref('');
  const category = ref('');
  const version = ref('');
  const sheetType = ref('');
  const artistKeyword = ref('');
  const noteDesignerKeyword = ref('');
  const minBreak = ref('');
  const maxBreak = ref('');

  const sortKey = ref('internalId');
  const sortDirection = ref('asc');

  const page = ref(1);
  const pageSize = ref(25);
  const pageSizeOptions = [25, 50, 100, 200];

  const songs = computed(() => parseSongsCsv(songsCsvRaw));
  const versionOrder = parseVersionsOrder(versionsCsvRaw);
  const versionOrderMap = new Map(versionOrder.map((name, idx) => [name, idx]));

  const difficultyOptions = computed(() => [...new Set(songs.value.map((song) => song.difficulty).filter(Boolean))]);
  const levelOptions = computed(() => {
    const levels = [...new Set(songs.value.map((song) => song.level).filter(Boolean))];
    return levels.sort((a, b) => {
      const left = getLevelSortValue(a);
      const right = getLevelSortValue(b);

      if (left !== right) {
        return left - right;
      }

      return String(a).localeCompare(String(b), 'zh-Hans-CN');
    });
  });
  const categoryOptions = computed(() => [...new Set(songs.value.map((song) => song.category).filter(Boolean))]);
  const versionOptions = computed(() => {
    const versions = [...new Set(songs.value.map((song) => song.version).filter(Boolean))];

    return versions.sort((a, b) => {
      const left = versionOrderMap.has(a) ? versionOrderMap.get(a) : Number.POSITIVE_INFINITY;
      const right = versionOrderMap.has(b) ? versionOrderMap.get(b) : Number.POSITIVE_INFINITY;

      if (left !== right) {
        return left - right;
      }

      return String(a).localeCompare(String(b), 'zh-Hans-CN');
    });
  });
  const sheetTypeOptions = computed(() => [...new Set(songs.value.map((song) => song.sheetType).filter(Boolean))]);

  const filteredSongs = computed(() => {
    const key = keyword.value.trim().toLowerCase();
    const artistKey = artistKeyword.value.trim().toLowerCase();
    const designerKey = noteDesignerKeyword.value.trim().toLowerCase();
    const minInternal = minInternalLevel.value === '' ? Number.NEGATIVE_INFINITY : Number(minInternalLevel.value);
    const maxInternal = maxInternalLevel.value === '' ? Number.POSITIVE_INFINITY : Number(maxInternalLevel.value);
    const minBreakValue = minBreak.value === '' ? Number.NEGATIVE_INFINITY : Number(minBreak.value);
    const maxBreakValue = maxBreak.value === '' ? Number.POSITIVE_INFINITY : Number(maxBreak.value);

    return songs.value.filter((song) => {
      if (key && !`${song.title} ${song.searchAcronyms || ''}`.toLowerCase().includes(key)) {
        return false;
      }

      if (difficulty.value && song.difficulty !== difficulty.value) {
        return false;
      }

      if (level.value && song.level !== level.value) {
        return false;
      }

      if (category.value && song.category !== category.value) {
        return false;
      }

      if (version.value && song.version !== version.value) {
        return false;
      }

      if (sheetType.value && song.sheetType !== sheetType.value) {
        return false;
      }

      if (artistKey && !song.artist.toLowerCase().includes(artistKey)) {
        return false;
      }

      if (designerKey && !song.noteDesigner.toLowerCase().includes(designerKey)) {
        return false;
      }

      if (song.internalLevelNum < minInternal || song.internalLevelNum > maxInternal) {
        return false;
      }

      if (song.noteBreakNum < minBreakValue || song.noteBreakNum > maxBreakValue) {
        return false;
      }

      return true;
    });
  });

  const sortedSongs = computed(() => {
    const sorted = [...filteredSongs.value];

    sorted.sort((a, b) => {
      const left = compareValue(a, sortKey.value);
      const right = compareValue(b, sortKey.value);

      if (typeof left === 'number' && typeof right === 'number') {
        return sortDirection.value === 'asc' ? left - right : right - left;
      }

      const result = String(left).localeCompare(String(right), 'zh-Hans-CN');
      return sortDirection.value === 'asc' ? result : -result;
    });

    return sorted;
  });

  const total = computed(() => sortedSongs.value.length);
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

  const pagedSongs = computed(() => {
    const start = (page.value - 1) * pageSize.value;
    return sortedSongs.value.slice(start, start + pageSize.value);
  });

  function setSort(key) {
    if (sortKey.value === key) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
      return;
    }

    sortKey.value = key;
    sortDirection.value = 'asc';
  }

  function resetFilters() {
    keyword.value = '';
    difficulty.value = '';
    level.value = '';
    minInternalLevel.value = '';
    maxInternalLevel.value = '';
    category.value = '';
    version.value = '';
    sheetType.value = '';
    artistKeyword.value = '';
    noteDesignerKeyword.value = '';
    minBreak.value = '';
    maxBreak.value = '';
  }

  watch([
    keyword,
    difficulty,
    level,
    minInternalLevel,
    maxInternalLevel,
    category,
    version,
    sheetType,
    artistKeyword,
    noteDesignerKeyword,
    minBreak,
    maxBreak,
  ], () => {
    page.value = 1;
  });

  watch(pageSize, () => {
    page.value = 1;
  });

  watch(totalPages, (newPages) => {
    if (page.value > newPages) {
      page.value = newPages;
    }
  });

  return {
    keyword,
    difficulty,
    level,
    minInternalLevel,
    maxInternalLevel,
    category,
    version,
    sheetType,
    artistKeyword,
    noteDesignerKeyword,
    minBreak,
    maxBreak,
    difficultyOptions,
    levelOptions,
    categoryOptions,
    versionOptions,
    sheetTypeOptions,
    sortKey,
    sortDirection,
    page,
    pageSize,
    pageSizeOptions,
    total,
    totalPages,
    pagedSongs,
    setSort,
    resetFilters,
  };
}
