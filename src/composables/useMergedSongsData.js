import { computed, ref, watch } from 'vue';
// eslint-disable-next-line import/no-unresolved
import mergedDataRaw from '../../data/raw/merged/merged-data.json?raw';

const difficultyOrder = {
  basic: 1,
  advanced: 2,
  expert: 3,
  master: 4,
  remaster: 5,
};

/**
 * 从混合数据源加载数据的 composable
 * 优势：
 * - maichart 的 ID：最准
 * - dxdata 的谱面数据：最全
 * - diving-fish 的谱师信息：用于补充空缺
 */
export default function useMergedSongsData() {
  const originalData = computed(() => {
    try {
      return JSON.parse(mergedDataRaw);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse merged data:', error);
      return { songs: [] };
    }
  });

  const keyword = ref('');
  const difficulty = ref('');
  const level = ref('');
  const minInternalLevel = ref('');
  const maxInternalLevel = ref('');
  const category = ref('');
  const version = ref('');
  const artistKeyword = ref('');
  const noteDesignerKeyword = ref('');
  const minBreak = ref('');
  const maxBreak = ref('');

  const sortKey = ref('id');
  const sortDirection = ref('asc');

  const page = ref(1);
  const pageSize = ref(25);
  const pageSizeOptions = [25, 50, 100, 200];

  /**
   * 扁平化数据以支持按行显示
   */
  const flattenedSongs = computed(() => {
    const flattened = [];

    originalData.value.songs?.forEach((song) => {
      const songBase = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        bpm: song.bpm,
        category: song.category,
        imageName: song.imageName,
        isNew: song.isNew,
        isLocked: song.isLocked,
        version: song.version,
        releaseDate: song.releaseDate,
        searchAcronyms: Array.isArray(song.searchAcronyms) ? song.searchAcronyms.join('|') : '',
        sheetType: '',
        difficulty: '',
        level: '',
        internalLevelValue: '',
        noteDesigner: '',
        noteCounts: null,
        isSpecial: '',
        sources: song.sources,
      };

      if (song.sheets && Array.isArray(song.sheets) && song.sheets.length > 0) {
        song.sheets.forEach((sheet) => {
          flattened.push({
            ...songBase,
            sheetType: sheet.type || 'dx',
            difficulty: sheet.difficulty || '',
            level: sheet.level || '',
            internalLevelValue: sheet.internalLevelValue || '',
            noteDesigner: sheet.noteDesigner || '',
            noteCounts: sheet.noteCounts || {},
            isSpecial: sheet.isSpecial || false,
            _rowId: `${song.id}-${sheet.type}-${sheet.difficulty}`,
            levelNum: Number(sheet.level?.replace(/\+/, '')) || 0,
            internalLevelNum: Number(sheet.internalLevelValue) || 0,
            noteBreakNum: sheet.noteCounts?.break || 0,
            difficultyRank: difficultyOrder[sheet.difficulty] || 999,
          });
        });
      } else {
        // 如果没有谱面数据，仍然创建一行
        flattened.push({
          ...songBase,
          _rowId: `${song.id}-no-sheets`,
        });
      }
    });

    return flattened;
  });

  /**
   * 获取所有版本列表
   */
  const versionsList = computed(() => {
    const versions = new Set();
    flattenedSongs.value.forEach((song) => {
      if (song.version) {
        versions.add(song.version);
      }
    });
    return Array.from(versions).sort();
  });

  /**
   * 检查歌曲是否匹配所有筛选条件
   */
  function isMatchFilters(song) {
    // 关键字搜索
    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      const songTitle = (song.title || '').toLowerCase();
      const titleDxdata = (song.titleDxdata || '').toLowerCase();
      const titleDivingFish = (song.titleDivingFish || '').toLowerCase();
      const searchAcronyms = (song.searchAcronyms || '').toLowerCase();

      if (
        !songTitle.includes(kw)
        && !titleDxdata.includes(kw)
        && !titleDivingFish.includes(kw)
        && !searchAcronyms.includes(kw)
      ) {
        return false;
      }
    }

    // 难度筛选
    if (difficulty.value && song.difficulty !== difficulty.value) {
      return false;
    }

    // 等级筛选
    if (level.value && song.level !== level.value) {
      return false;
    }

    // 难度定数范围筛选
    if (minInternalLevel.value) {
      const min = Number(minInternalLevel.value);
      const val = Number(song.internalLevelValue) || 0;
      if (val < min) {
        return false;
      }
    }

    if (maxInternalLevel.value) {
      const max = Number(maxInternalLevel.value);
      const val = Number(song.internalLevelValue) || 0;
      if (val > max) {
        return false;
      }
    }

    // 分类筛选
    if (category.value && song.category !== category.value) {
      return false;
    }

    // 版本筛选
    if (version.value && song.version !== version.value) {
      return false;
    }

    // 艺术家筛选
    if (artistKeyword.value) {
      const kw = artistKeyword.value.toLowerCase();
      const artist = (song.artist || '').toLowerCase();
      if (!artist.includes(kw)) {
        return false;
      }
    }

    // 谱师筛选
    if (noteDesignerKeyword.value) {
      const kw = noteDesignerKeyword.value.toLowerCase();
      const designer = (song.noteDesigner || '').toLowerCase();
      if (!designer.includes(kw)) {
        return false;
      }
    }

    // break 数量筛选
    if (minBreak.value) {
      const min = Number(minBreak.value);
      const val = song.noteBreakNum || 0;
      if (val < min) {
        return false;
      }
    }

    if (maxBreak.value) {
      const max = Number(maxBreak.value);
      const val = song.noteBreakNum || 0;
      if (val > max) {
        return false;
      }
    }

    return true;
  }

  /**
   * 比较用于排序
   */
  function compareValue(song, key) {
    if (key === 'id') {
      return Number(song.id) || 0;
    }

    if (key === 'difficulty') {
      return song.difficultyRank;
    }

    if (key === 'internalLevelValue') {
      return song.internalLevelNum;
    }

    if (key === 'noteBreakNum') {
      return song.noteBreakNum;
    }

    if (key === 'level') {
      return song.levelNum;
    }

    return song[key] ?? '';
  }

  /**
   * 筛选后的歌曲列表
   */
  const filteredSongs = computed(() => {
    const filtered = flattenedSongs.value.filter(isMatchFilters);

    // 排序
    filtered.sort((a, b) => {
      const aVal = compareValue(a, sortKey.value);
      const bVal = compareValue(b, sortKey.value);

      let comparison = 0;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        comparison = aStr.localeCompare(bStr);
      }

      return sortDirection.value === 'asc' ? comparison : -comparison;
    });

    return filtered;
  });

  /**
   * 分页后的歌曲列表
   */
  const displayedSongs = computed(() => {
    const startIdx = (page.value - 1) * pageSize.value;
    const endIdx = startIdx + pageSize.value;
    return filteredSongs.value.slice(startIdx, endIdx);
  });

  /**
   * 统计信息
   */
  const statistics = computed(() => {
    const stats = {
      total: flattenedSongs.value.length,
      filtered: filteredSongs.value.length,
      dxdataMatches: 0,
      divingFishMatches: 0,
      allSourcesMatches: 0,
      withDesigner: 0,
      withoutDesigner: 0,
    };

    filteredSongs.value.forEach((song) => {
      if (song.sources?.dxdata) stats.dxdataMatches += 1;
      if (song.sources?.divingFish) stats.divingFishMatches += 1;
      if (song.sources?.dxdata && song.sources?.divingFish && song.sources?.maichart) {
        stats.allSourcesMatches += 1;
      }
      if (song.noteDesigner && song.noteDesigner !== '-' && song.noteDesigner !== '') {
        stats.withDesigner += 1;
      } else {
        stats.withoutDesigner += 1;
      }
    });

    return stats;
  });

  /**
   * 分页信息
   */
  const pagination = computed(() => {
    const total = filteredSongs.value.length;
    const totalPages = Math.ceil(total / pageSize.value);

    return {
      page: page.value,
      pageSize: pageSize.value,
      total,
      totalPages,
      start: (page.value - 1) * pageSize.value + 1,
      end: Math.min(page.value * pageSize.value, total),
    };
  });

  /**
   * 重置页码（当筛选条件改变时）
   */
  watch(
    () => [
      keyword.value,
      difficulty.value,
      level.value,
      minInternalLevel.value,
      maxInternalLevel.value,
      category.value,
      version.value,
      artistKeyword.value,
      noteDesignerKeyword.value,
      minBreak.value,
      maxBreak.value,
      sortKey.value,
      sortDirection.value,
    ],
    () => {
      page.value = 1;
    },
  );

  return {
    // 数据
    originalData,
    flattenedSongs,
    filteredSongs,
    displayedSongs,
    versionsList,

    // 筛选和排序条件
    keyword,
    difficulty,
    level,
    minInternalLevel,
    maxInternalLevel,
    category,
    version,
    artistKeyword,
    noteDesignerKeyword,
    minBreak,
    maxBreak,
    sortKey,
    sortDirection,

    // 分页
    page,
    pageSize,
    pageSizeOptions,
    pagination,

    // 统计信息
    statistics,

    // 方法
    isMatchFilters,
  };
}
