export const SOURCE_PRIORITY = ['maichart', 'dxdata', 'divingFish'];

export const MERGE_RULES = {
  song: {
    id: {
      sources: {
        maichart: 'id',
        dxdata: 'sheets.0.internalId',
        divingFish: 'id',
      },
      translate: {
        zh_cn: '数字ID',
      },
    },
    title: {
      sources: {
        maichart: 'title',
        dxdata: 'title',
        divingFish: 'title',
      },
      translate: {
        zh_cn: '曲名',
      },
    },
    artist: {
      sources: {
        dxdata: 'artist',
        divingFish: 'basic_info.artist',
      },
      translate: {
        zh_cn: '艺术家',
      },
    },
    bpm: {
      sources: {
        dxdata: 'bpm',
        divingFish: 'basic_info.bpm',
      },
      translate: {
        zh_cn: 'BPM',
      },
    },
    category: {
      sources: {
        dxdata: 'category',
        divingFish: 'basic_info.genre',
      },
      translate: {
        zh_cn: '分类',
      },
    },
    imageName: {
      sources: {
        dxdata: 'imageName',
      },
      translate: {
        zh_cn: '封面哈希',
      },
    },
    isNew: {
      sources: {
        dxdata: 'isNew',
        divingFish: 'basic_info.is_new',
      },
      translate: {
        zh_cn: '是否新增',
      },
    },
    isLocked: {
      sources: {
        dxdata: 'isLocked',
      },
      translate: {
        zh_cn: '是否锁定',
      },
    },
    version: {
      sources: {
        dxdata: 'version',
        divingFish: 'basic_info.from',
      },
      translate: {
        zh_cn: '版本',
      },
    },
    releaseDate: {
      sources: {
        dxdata: 'releaseDate',
        divingFish: 'basic_info.release_date',
      },
      translate: {
        zh_cn: '追加日期',
      },
    },
    searchAcronyms: {
      sources: {
        dxdata: 'searchAcronyms',
      },
      translate: {
        zh_cn: '搜索别名',
      },
    },
  },
  sheet: {
    type: {
      sources: {
        dxdata: 'type',
        divingFish: 'type',
      },
      translate: {
        zh_cn: '谱面类型',
      },
    },
    difficulty: {
      sources: {
        dxdata: 'difficulty',
        divingFish: 'difficulty',
      },
      translate: {
        zh_cn: '难度',
      },
    },
    level: {
      sources: {
        dxdata: 'level',
        divingFish: 'level',
      },
      translate: {
        zh_cn: '等级',
      },
    },
    internalLevelValue: {
      sources: {
        dxdata: 'internalLevelValue',
        divingFish: 'ds',
      },
      translate: {
        zh_cn: '详细定数',
      },
    },
    noteDesigner: {
      sources: {
        dxdata: 'noteDesigner',
        divingFish: 'charter',
      },
      translate: {
        zh_cn: '谱师',
      },
    },
    noteCounts: {
      sources: {
        dxdata: 'noteCounts',
        divingFish: 'notes',
      },
      translate: {
        zh_cn: 'note统计',
      },
    },
    isSpecial: {
      sources: {
        dxdata: 'isSpecial',
      },
      translate: {
        zh_cn: '特殊谱面',
      },
    },
    version: {
      sources: {
        dxdata: 'version',
        divingFish: 'version',
      },
      translate: {
        zh_cn: '版本',
      },
    },
    internalId: {
      sources: {
        dxdata: 'id',
        divingFish: 'id',
      },
      translate: {
        zh_cn: '内部ID',
      },
    },
    releaseDate: {
      sources: {
        dxdata: 'releaseDate',
        divingFish: 'releaseDate',
      },
      translate: {
        zh_cn: '追加日期',
      },
    },
  },
};

export function getByPath(source, path) {
  if (!source || !path) {
    return undefined;
  }

  return String(path).split('.').reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    return current[key];
  }, source);
}

export function firstNonEmptyValue(values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    if (typeof value === 'string' && value.trim() === '') {
      continue;
    }

    return value;
  }

  return undefined;
}

export function buildFieldMeta(fieldRule, sourceValues, mergedValue, selectedSource) {
  return {
    value: mergedValue,
    translate: fieldRule?.translate || {},
    sources: fieldRule?.sources || {},
    selectedSource: selectedSource || null,
    sourceValues,
  };
}
