import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MERGE_RULES, SOURCE_PRIORITY, buildFieldMeta, firstNonEmptyValue, getByPath } from './merge-schema.mjs';

const ROOT_DIR = resolve(process.cwd());
const RAW_DIR = resolve(ROOT_DIR, 'data', 'raw');
const OUTPUT_DIR = resolve(RAW_DIR, 'merged');

const DXDATA_PATH = resolve(RAW_DIR, 'dxdata', 'dxdata.json');
const DIVING_FISH_PATH = resolve(RAW_DIR, 'diving-fish', 'music_data.json');
const MAICHART_PATH = resolve(RAW_DIR, 'maichart', 'index.json');
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'merged-data.json');

/**
 * 合并混合数据源
 * 优先级：
 * 1. maichart 的 ID：优先作为主键（输出字段名仍为 id）
 * 2. 若 maichart ID 缺失，则回退 dxrating(dxdata) 的 internalId
 * 3. 若仍缺失，再回退 diving-fish 的 ID
 * 2. dxdata：谱面数据最全，谱面详情和难度信息来自这里
 * 3. diving-fish：数据准确但不全，用于填补谱师等空缺信息
 */

function normalizeId(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function extractDxratingInternalIds(dxdataSong) {
  if (!dxdataSong) {
    return [];
  }

  const internalIds = new Set();

  const directInternalId = normalizeId(dxdataSong.internalId);
  if (directInternalId) {
    internalIds.add(directInternalId);
  }

  if (!Array.isArray(dxdataSong.sheets)) {
    return Array.from(internalIds);
  }

  for (const sheet of dxdataSong.sheets) {
    const sheetInternalId = normalizeId(sheet?.internalId);
    if (sheetInternalId) {
      internalIds.add(sheetInternalId);
    }
  }

  return Array.from(internalIds);
}

function resolveSongId(maichartId, dxdataSong, divingFishSong) {
  const dxratingIds = extractDxratingInternalIds(dxdataSong);
  const maichartSongId = normalizeId(maichartId);
  const divingFishId = normalizeId(divingFishSong?.id);

  return maichartSongId || dxratingIds[0] || divingFishId;
}

async function readJson(filePath) {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error.message);
    return null;
  }
}

function isMeaningfulValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'string') {
    return value.trim() !== '';
  }

  return true;
}

function buildFieldRuleMeta(fieldRules, sourceBundle, mergedValues) {
  const meta = {};

  for (const [fieldName, fieldRule] of Object.entries(fieldRules)) {
    const sourceValues = {};
    let selectedSource = null;
    const candidateValues = [];

    for (const sourceName of SOURCE_PRIORITY) {
      const sourcePath = fieldRule.sources?.[sourceName];
      const sourceValue = sourcePath ? getByPath(sourceBundle[sourceName], sourcePath) : undefined;
      sourceValues[sourceName] = sourceValue;
      candidateValues.push(sourceValue);

      if (selectedSource === null && isMeaningfulValue(sourceValue)) {
        selectedSource = sourceName;
      }
    }

    const mergedValue = Object.prototype.hasOwnProperty.call(mergedValues, fieldName)
      ? mergedValues[fieldName]
      : firstNonEmptyValue(candidateValues);

    meta[fieldName] = buildFieldMeta(fieldRule, sourceValues, mergedValue, selectedSource);
  }

  return meta;
}

function collapseWhitespace(text) {
  return String(text).replaceAll(/[\u3000\s]+/gu, ' ').trim();
}

function removeUtagePrefix(title) {
  return String(title).replace(/^[\[［][^\]］]{1,8}[\]］]\s*/u, '').trim();
}

function canonicalizeTitle(title) {
  if (!title) {
    return '';
  }

  const normalized = String(title).normalize('NFKC').toLowerCase();
  return collapseWhitespace(removeUtagePrefix(normalized));
}

function compactTitleForMatch(title) {
  if (!title) {
    return '';
  }

  return canonicalizeTitle(title).replaceAll(/[\p{Z}\p{P}\p{S}]/gu, '');
}

function buildTitleKeys(title) {
  return {
    exactKey: canonicalizeTitle(title),
    compactKey: compactTitleForMatch(title),
  };
}

function addArrayIndex(indexMap, key, value) {
  if (!key) {
    return;
  }

  if (!indexMap.has(key)) {
    indexMap.set(key, []);
  }

  indexMap.get(key).push(value);
}

function pickUniqueCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return null;
}

/**
 * 规范化标题用于匹配
 */
function normalizeTitleForMatch(title) {
  return compactTitleForMatch(title);
}

/**
 * 从 dxdata 构建按标题的索引
 */
function buildDxdataIndex(dxdata) {
  const indexById = new Map();
  const indexByInternalId = new Map();
  const indexByTitleExact = new Map();
  const indexByTitleCompact = new Map();

  if (dxdata?.songs && Array.isArray(dxdata.songs)) {
    dxdata.songs.forEach((song) => {
      const id = song.id || song.songId;
      const title = song.title || song.name;
      const internalIds = extractDxratingInternalIds(song);

      if (id) {
        indexById.set(String(id), song);
      }
      for (const internalId of internalIds) {
        indexByInternalId.set(internalId, song);
      }
      if (title) {
        const { exactKey, compactKey } = buildTitleKeys(title);
        addArrayIndex(indexByTitleExact, exactKey, song);
        addArrayIndex(indexByTitleCompact, compactKey, song);
      }
    });
  }

  return {
    indexById,
    indexByInternalId,
    indexByTitleExact,
    indexByTitleCompact,
  };
}

/**
 * 从 diving-fish 构建按标题的索引
 */
function buildDivingFishIndex(divingFish) {
  const indexById = new Map();
  const indexByTitleExact = new Map();
  const indexByTitleCompact = new Map();

  if (Array.isArray(divingFish)) {
    divingFish.forEach((song) => {
      const id = song.id;
      const title = song.title;

      if (id) {
        indexById.set(String(id), song);
      }
      if (title) {
        const { exactKey, compactKey } = buildTitleKeys(title);
        addArrayIndex(indexByTitleExact, exactKey, song);
        addArrayIndex(indexByTitleCompact, compactKey, song);
      }
    });
  }

  return {
    indexById,
    indexByTitleExact,
    indexByTitleCompact,
  };
}

function normalizeDivingFishSongType(type) {
  const normalized = String(type || '').trim().toUpperCase();

  if (normalized === 'SD') {
    return 'std';
  }

  if (normalized === 'DX') {
    return 'dx';
  }

  return '';
}

function findDivingFishChartForSheet(dxdataSheet, divingFishSong) {
  if (!dxdataSheet || !divingFishSong || !Array.isArray(divingFishSong.charts)) {
    return null;
  }

  const expectedType = normalizeDivingFishSongType(divingFishSong.type);
  if (!expectedType) {
    return null;
  }

  const sheetType = String(dxdataSheet.type || '').trim().toLowerCase();
  if (sheetType !== expectedType) {
    return null;
  }

  const difficultyOrder = ['basic', 'advanced', 'expert', 'master', 'remaster'];
  const chartIndex = difficultyOrder.indexOf(String(dxdataSheet.difficulty || '').trim().toLowerCase());
  if (chartIndex < 0) {
    return null;
  }

  const chart = divingFishSong.charts[chartIndex];
  if (!chart) {
    return null;
  }

  const level = divingFishSong.level?.[chartIndex];
  const ds = divingFishSong.ds?.[chartIndex];
  return extractDivingFishChartInfo(chart, dxdataSheet.difficulty, level, ds);
}

function filterDxdataSheetsForSong(dxdataSong, songId) {
  if (!dxdataSong?.sheets || !Array.isArray(dxdataSong.sheets)) {
    return [];
  }

  const normalizedSongId = normalizeId(songId);
  if (!normalizedSongId) {
    return dxdataSong.sheets;
  }

  const matchedSheets = dxdataSong.sheets.filter((sheet) => normalizeId(sheet?.internalId) === normalizedSongId);
  return matchedSheets.length > 0 ? matchedSheets : dxdataSong.sheets;
}

function findSongByTitle(title, indexByTitleExact, indexByTitleCompact) {
  const { exactKey, compactKey } = buildTitleKeys(title);

  const exactCandidate = pickUniqueCandidate(indexByTitleExact.get(exactKey));
  if (exactCandidate) {
    return exactCandidate;
  }

  return pickUniqueCandidate(indexByTitleCompact.get(compactKey));
}

/**
 * 通过标题查找对应的 dxdata 歌曲
 */
function findDxdataSongByTitle(title, indexByTitleExact, indexByTitleCompact) {
  return findSongByTitle(title, indexByTitleExact, indexByTitleCompact);
}

/**
 * 通过标题查找对应的 diving-fish 歌曲
 */
function findDivingFishSongByTitle(title, indexByTitleExact, indexByTitleCompact) {
  return findSongByTitle(title, indexByTitleExact, indexByTitleCompact);
}

/**
 * 从 dxdata sheet 提取谱面信息
 */
function extractSheetInfo(sheet, difficulty) {
  if (!sheet) return null;

  return {
    type: sheet.type || 'dx',
    difficulty: difficulty || sheet.difficulty || '',
    level: sheet.level || '',
    internalLevelValue: sheet.internalLevelValue || '',
    noteDesigner: sheet.noteDesigner || sheet.charter || '',
    noteCounts: sheet.noteCounts ? { ...sheet.noteCounts } : null,
    isSpecial: sheet.isSpecial || false,
    version: sheet.version || '',
    internalId: sheet.internalId || '',
    releaseDate: sheet.releaseDate || '',
  };
}

/**
 * 从 diving-fish chart 提取谱面信息
 */
function extractDivingFishChartInfo(chart, difficulty, level, ds) {
  if (!chart) return null;

  const notes = chart.notes || [];
  return {
    type: 'unknown',
    difficulty: difficulty || '',
    level: level || '',
    internalLevelValue: ds || '',
    noteDesigner: chart.charter || '',
    noteCounts: {
      tap: notes[0] || 0,
      hold: notes[1] || 0,
      slide: notes[2] || 0,
      touch: notes.length >= 5 ? notes[3] : 0,
      break: notes.length >= 5 ? notes[4] : (notes[3] || 0),
      total: notes.reduce((sum, n) => sum + (Number(n) || 0), 0),
    },
    isSpecial: false,
    version: '',
    internalId: '',
    releaseDate: '',
  };
}

/**
 * 合并两个谱面信息，优先使用 dxdata，用 diving-fish 填补空缺
 */
function mergeSheetInfo(dxdataSheet, divingFishChart) {
  if (!dxdataSheet && !divingFishChart) return null;

  const merged = { ...dxdataSheet };

  if (divingFishChart) {
    // 如果 dxdata 中没有谱师信息，使用 diving-fish 的
    if (!merged.noteDesigner || merged.noteDesigner === '-' || merged.noteDesigner === '') {
      merged.noteDesigner = divingFishChart.noteDesigner;
    }

    // 如果 dxdata 中没有 noteCounts，使用 diving-fish 的
    if (!merged.noteCounts || Object.keys(merged.noteCounts).length === 0) {
      merged.noteCounts = divingFishChart.noteCounts;
    }

    // 如果 dxdata 中没有标注信息，使用 diving-fish 的
    if (!merged.level || merged.level === '') {
      merged.level = divingFishChart.level;
    }
    if (!merged.internalLevelValue || merged.internalLevelValue === '') {
      merged.internalLevelValue = divingFishChart.internalLevelValue;
    }
  }

  return merged;
}

function buildSheetFieldValues(dxdataSheet, divingFishChart, mergedSheet) {
  const sourceBundle = {
    dxdata: dxdataSheet,
    divingFish: divingFishChart,
    maichart: null,
  };

  return {
    mergedValues: {
      type: mergedSheet.type,
      difficulty: mergedSheet.difficulty,
      level: mergedSheet.level,
      internalLevelValue: mergedSheet.internalLevelValue,
      noteDesigner: mergedSheet.noteDesigner,
      noteCounts: mergedSheet.noteCounts,
      isSpecial: mergedSheet.isSpecial,
      version: mergedSheet.version,
      internalId: mergedSheet.internalId,
      releaseDate: mergedSheet.releaseDate,
    },
    sourceBundle,
  };
}

function buildRawSourceBundle(maichartId, maichartTitle, dxdataSong, divingFishSong) {
  return {
    maichart: {
      id: maichartId,
      title: maichartTitle,
    },
    dxdata: dxdataSong || null,
    divingFish: divingFishSong || null,
  };
}

/**
 * 合并单个歌曲的所有信息
 */
function mergeSongData(maichartId, maichartTitle, dxdataSong, divingFishSong) {
  const resolvedSongId = resolveSongId(maichartId, dxdataSong, divingFishSong);
  const rawSources = buildRawSourceBundle(maichartId, maichartTitle, dxdataSong, divingFishSong);
  const merged = {
    id: resolvedSongId,
    title: maichartTitle,
    titleDxdata: dxdataSong?.title || dxdataSong?.name || '',
    titleDivingFish: divingFishSong?.title || '',
    artist: dxdataSong?.artist || divingFishSong?.basic_info?.artist || '',
    bpm: dxdataSong?.bpm || divingFishSong?.basic_info?.bpm || '',
    category: dxdataSong?.category || dxdataSong?.genre || divingFishSong?.basic_info?.genre || '',
    imageName: dxdataSong?.imageName || dxdataSong?.dimg || '',
    isNew: dxdataSong?.isNew ?? divingFishSong?.basic_info?.is_new ?? false,
    isLocked: dxdataSong?.isLocked ?? false,
    version: dxdataSong?.version || divingFishSong?.basic_info?.from || '',
    releaseDate: dxdataSong?.releaseDate || divingFishSong?.basic_info?.release_date || '',
    sheets: [],
    sources: {
      dxdata: !!dxdataSong,
      divingFish: !!divingFishSong,
      maichart: true,
    },
    sourceRecords: rawSources,
    searchAcronyms: dxdataSong?.searchAcronyms || [],
  };

  merged.fieldRules = buildFieldRuleMeta(MERGE_RULES.song, rawSources, {
    id: merged.id,
    title: merged.title,
    artist: merged.artist,
    bpm: merged.bpm,
    category: merged.category,
    imageName: merged.imageName,
    isNew: merged.isNew,
    isLocked: merged.isLocked,
    version: merged.version,
    releaseDate: merged.releaseDate,
    searchAcronyms: merged.searchAcronyms,
  });

  // 从 dxdata 的 sheets 构建谱面信息
  const dxdataSheets = filterDxdataSheetsForSong(dxdataSong, resolvedSongId);
  if (dxdataSheets.length > 0) {
    dxdataSheets.forEach((dxSheet) => {
      const difficulty = dxSheet.difficulty || '';
      const dxSheetInfo = extractSheetInfo(dxSheet, difficulty);

      // 查找对应的 diving-fish chart 来补充谱师信息
      const divingFishChart = findDivingFishChartForSheet(dxSheet, divingFishSong);

      const mergedSheet = mergeSheetInfo(dxSheetInfo, divingFishChart);
      if (mergedSheet) {
        const { mergedValues, sourceBundle } = buildSheetFieldValues(dxSheetInfo, divingFishChart, mergedSheet);
        mergedSheet.sourceRecords = {
          dxdata: dxSheet,
          divingFish: divingFishChart,
        };
        mergedSheet.fieldRules = buildFieldRuleMeta(MERGE_RULES.sheet, sourceBundle, mergedValues);
        merged.sheets.push(mergedSheet);
      }
    });
  }

  // 如果 dxdata 没有谱面信息，尝试从 diving-fish 构建
  if (merged.sheets.length === 0 && divingFishSong?.charts && Array.isArray(divingFishSong.charts)) {
    const sheetType = divingFishSong.type || 'dx';
    const difficulties = ['basic', 'advanced', 'expert', 'master', 'remaster'];

    divingFishSong.charts.forEach((chart, index) => {
      const difficulty = difficulties[index] || `difficulty-${index}`;
      const level = divingFishSong.level?.[index];
      const ds = divingFishSong.ds?.[index];

      const sheetInfo = extractDivingFishChartInfo(chart, difficulty, level, ds);
      if (sheetInfo) {
        sheetInfo.type = sheetType;
        sheetInfo.sourceRecords = {
          dxdata: null,
          divingFish: chart,
        };
        sheetInfo.fieldRules = buildFieldRuleMeta(MERGE_RULES.sheet, {
          dxdata: null,
          divingFish: chart,
          maichart: null,
        }, {
          type: sheetInfo.type,
          difficulty: sheetInfo.difficulty,
          level: sheetInfo.level,
          internalLevelValue: sheetInfo.internalLevelValue,
          noteDesigner: sheetInfo.noteDesigner,
          noteCounts: sheetInfo.noteCounts,
          isSpecial: sheetInfo.isSpecial,
          version: sheetInfo.version,
          internalId: sheetInfo.internalId,
          releaseDate: sheetInfo.releaseDate,
        });
        merged.sheets.push(sheetInfo);
      }
    });
  }

  return merged;
}

async function main() {
  try {
    console.log('开始合并数据源...\n');

    // 创建输出目录
    await mkdir(OUTPUT_DIR, { recursive: true });

    // 加载三个数据源
    console.log('正在加载数据源...');
    const dxdata = await readJson(DXDATA_PATH);
    const divingFish = await readJson(DIVING_FISH_PATH);
    const maichart = await readJson(MAICHART_PATH);

    if (!maichart) {
      throw new Error('Failed to load maichart data');
    }

    console.log('✓ 已加载 dxdata');
    console.log('✓ 已加载 diving-fish');
    console.log('✓ 已加载 maichart');

    // 构建索引便于查询
    const {
      indexByInternalId: dxdataIndexByInternalId,
      indexByTitleExact: dxdataIndexByTitleExact,
      indexByTitleCompact: dxdataIndexByTitleCompact,
    } = buildDxdataIndex(dxdata);
    const {
      indexById: divingFishIndexById,
      indexByTitleExact: divingFishIndexByTitleExact,
      indexByTitleCompact: divingFishIndexByTitleCompact,
    } = buildDivingFishIndex(divingFish);

    console.log(`\n开始合并 ${Object.keys(maichart).length} 首歌曲...`);

    const mergedSongs = [];
    let dxdataMatches = 0;
    let divingFishMatches = 0;

    for (const [maichartId, maichartTitle] of Object.entries(maichart)) {
      const normalizedMaichartId = normalizeId(maichartId);

      // 先走 ID 匹配，再回退标题匹配
      const dxdataSong =
        dxdataIndexByInternalId.get(normalizedMaichartId)
        || findDxdataSongByTitle(maichartTitle, dxdataIndexByTitleExact, dxdataIndexByTitleCompact);

      const divingFishSong =
        divingFishIndexById.get(normalizedMaichartId)
        || findDivingFishSongByTitle(maichartTitle, divingFishIndexByTitleExact, divingFishIndexByTitleCompact);

      if (dxdataSong) dxdataMatches += 1;
      if (divingFishSong) divingFishMatches += 1;

      const merged = mergeSongData(maichartId, maichartTitle, dxdataSong, divingFishSong);
      mergedSongs.push(merged);
    }

    const result = {
      metadata: {
        version: '1.0.0',
        mergedAt: new Date().toISOString(),
        totalSongs: mergedSongs.length,
        dxdataMatches,
        divingFishMatches,
        description: '混合数据源：maichart(ID) + dxdata(谱面) + diving-fish(谱师)',
        sources: {
          maichart: {
            status: 'healthy',
            lastFetchTime: new Date().toISOString(),
            matchCount: mergedSongs.length,
          },
          dxdata: {
            status: dxdataMatches > 0 ? 'healthy' : 'warning',
            lastFetchTime: new Date().toISOString(),
            matchCount: dxdataMatches,
          },
          divingFish: {
            status: divingFishMatches > 0 ? 'healthy' : 'warning',
            lastFetchTime: new Date().toISOString(),
            matchCount: divingFishMatches,
          },
        },
      },
      songs: mergedSongs,
    };

    // 保存合并后的数据
    await writeFile(OUTPUT_PATH, JSON.stringify(result) + '\n', 'utf8');

    console.log('\n✓ 合并完成！');
    console.log(`  总歌曲数: ${mergedSongs.length}`);
    console.log(`  匹配到 dxdata: ${dxdataMatches} 首 (${((dxdataMatches / mergedSongs.length) * 100).toFixed(1)}%)`);
    console.log(`  匹配到 diving-fish: ${divingFishMatches} 首 (${((divingFishMatches / mergedSongs.length) * 100).toFixed(1)}%)`);
    console.log(`  输出：${OUTPUT_PATH}`);

    // 分析数据覆盖情况
    let totalSheets = 0;
    let sheetsWithDesigner = 0;

    mergedSongs.forEach((song) => {
      song.sheets.forEach((sheet) => {
        totalSheets += 1;
        if (sheet.noteDesigner && sheet.noteDesigner !== '-' && sheet.noteDesigner !== '') {
          sheetsWithDesigner += 1;
        }
      });
    });

    console.log(`\n谱面统计：`);
    console.log(`  总谱面数: ${totalSheets}`);
    console.log(`  有谱师信息: ${sheetsWithDesigner} 首 (${((sheetsWithDesigner / totalSheets) * 100).toFixed(1)}%)`);
    console.log(`  缺谱师信息: ${totalSheets - sheetsWithDesigner} 首 (${(((totalSheets - sheetsWithDesigner) / totalSheets) * 100).toFixed(1)}%)`);
  } catch (error) {
    console.error('合并失败:', error.message);
    process.exit(1);
  }
}

main();
