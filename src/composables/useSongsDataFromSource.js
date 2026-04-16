import { computed, ref } from 'vue';

const difficultyOrder = {
  basic: 1,
  advanced: 2,
  expert: 3,
  master: 4,
  remaster: 5,
};

/**
 * 从动态加载的数据源处理歌曲数据的 composable
 * 支持 DXData、Diving Fish 和 Merged 数据源
 */
export default function useSongsDataFromSource(sourceData) {
  const originalData = computed(() => {
    if (!sourceData.value) {
      return { songs: [] };
    }

    // DXData 和 Merged 有相同的结构
    if (sourceData.value.songs) {
      return sourceData.value;
    }

    // Diving Fish 数据结构不同，需要转换
    if (sourceData.value.music_data) {
      return { songs: sourceData.value.music_data };
    }

    return { songs: [] };
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
        searchAcronyms: Array.isArray(song.searchAcronyms)
          ? song.searchAcronyms.join('|')
          : '',
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
        flattened.push({
          ...songBase,
          _rowId: `${song.id}`,
          levelNum: 0,
          internalLevelNum: 0,
          noteBreakNum: 0,
          difficultyRank: 999,
        });
      }
    });

    return flattened;
  });

  /**
   * 应用筛选条件
   */
  const filteredSongs = computed(() => {
    let result = flattenedSongs.value;

    if (keyword.value) {
      const kw = keyword.value.toLowerCase();
      result = result.filter((song) => {
        const titleMatch = song.title?.toLowerCase().includes(kw);
        const artistMatch = song.artist?.toLowerCase().includes(kw);
        const acronymMatch = song.searchAcronyms?.toLowerCase().includes(kw);
        return titleMatch || artistMatch || acronymMatch;
      });
    }

    if (difficulty.value) {
      result = result.filter((song) => song.difficulty === difficulty.value);
    }

    if (level.value) {
      result = result.filter((song) => song.level === level.value);
    }

    if (minInternalLevel.value) {
      const min = parseFloat(minInternalLevel.value);
      result = result.filter((song) => (song.internalLevelNum || 0) >= min);
    }

    if (maxInternalLevel.value) {
      const max = parseFloat(maxInternalLevel.value);
      result = result.filter((song) => (song.internalLevelNum || 0) <= max);
    }

    if (category.value) {
      result = result.filter((song) => song.category === category.value);
    }

    if (version.value) {
      result = result.filter((song) => song.version === version.value);
    }

    if (artistKeyword.value) {
      const kw = artistKeyword.value.toLowerCase();
      result = result.filter((song) => song.artist?.toLowerCase().includes(kw));
    }

    if (noteDesignerKeyword.value) {
      const kw = noteDesignerKeyword.value.toLowerCase();
      result = result.filter((song) => song.noteDesigner?.toLowerCase().includes(kw));
    }

    if (minBreak.value) {
      const min = parseInt(minBreak.value, 10);
      result = result.filter((song) => (song.noteBreakNum || 0) >= min);
    }

    if (maxBreak.value) {
      const max = parseInt(maxBreak.value, 10);
      result = result.filter((song) => (song.noteBreakNum || 0) <= max);
    }

    return result;
  });

  /**
   * 应用排序
   */
  const sortedSongs = computed(() => {
    const sorted = [...filteredSongs.value];

    sorted.sort((a, b) => {
      let aVal = a[sortKey.value];
      let bVal = b[sortKey.value];

      // 处理不存在的字段
      if (aVal === undefined || aVal === null) aVal = '';
      if (bVal === undefined || bVal === null) bVal = '';

      let comparison = 0;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal, 'zh-CN');
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'zh-CN');
      }

      return sortDirection.value === 'asc' ? comparison : -comparison;
    });

    return sorted;
  });

  /**
   * 分页
   */
  const pagination = computed(() => {
    const total = sortedSongs.value.length;
    const totalPages = Math.ceil(total / pageSize.value);

    return {
      total,
      currentPage: Math.min(page.value, totalPages),
      pageSize: pageSize.value,
      totalPages,
      hasNextPage: page.value < totalPages,
      hasPrevPage: page.value > 1,
      startIndex: (page.value - 1) * pageSize.value + 1,
      endIndex: Math.min(page.value * pageSize.value, total),
    };
  });

  const displayedSongs = computed(() => {
    const start = (pagination.value.currentPage - 1) * pageSize.value;
    const end = start + pageSize.value;
    return sortedSongs.value.slice(start, end);
  });

  /**
   * 统计信息
   */
  const statistics = computed(() => {
    const stats = {
      totalSongs: new Set(),
      totalSheets: 0,
      difficultyCount: {
        basic: 0, advanced: 0, expert: 0, master: 0, remaster: 0,
      },
      maxLevel: 0,
    };

    sortedSongs.value.forEach((row) => {
      stats.totalSongs.add(row.id);
      if (row.difficulty) {
        stats.totalSheets += 1;
        stats.difficultyCount[row.difficulty] ||= 0;
        stats.difficultyCount[row.difficulty] += 1;
        const rowLevel = parseFloat(row.level) || 0;
        stats.maxLevel = Math.max(stats.maxLevel, rowLevel);
      }
    });

    return {
      totalSongs: stats.totalSongs.size,
      totalSheets: stats.totalSheets,
      ...stats.difficultyCount,
      maxLevel: stats.maxLevel.toFixed(1),
    };
  });

  /**
   * 获取版本列表
   */
  const versionsList = computed(() => {
    const versions = new Set();
    originalData.value.songs?.forEach((song) => {
      if (song.version) {
        versions.add(song.version);
      }
    });
    return Array.from(versions).sort();
  });

  return {
    originalData,
    flattenedSongs,
    filteredSongs,
    sortedSongs,
    displayedSongs,
    versionsList,
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
    page,
    pageSize,
    pageSizeOptions,
    pagination,
    statistics,
  };
}
