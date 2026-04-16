<script setup>
import {
  computed, ref, watch, onMounted,
} from 'vue';
import { useRouter } from 'vue-router';
import SongsDataTable from '@/components/songs/SongsDataTable.vue';
import useSongsDataFromSource from '@/composables/useSongsDataFromSource.js';
import useExportData from '@/composables/useExportData.js';
import { useLoadedDataStore } from '@/stores/loadedDataStore.js';
import useTheme from '@/composables/useTheme.js';

const router = useRouter();
const { currentTheme, switchTheme } = useTheme();
const { exportData } = useExportData();

// 从内存 store 加载数据源
const sourceData = ref(null);
const loadedSource = ref(null);
const isLoading = ref(true);
const { loadedData, loadedSource: activeSource } = useLoadedDataStore();

onMounted(() => {
  try {
    if (!activeSource.value || !loadedData.value) {
      router.push('/');
      return;
    }

    sourceData.value = loadedData.value;
    loadedSource.value = activeSource.value;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load source data:', error);
    router.push('/');
  } finally {
    isLoading.value = false;
  }
});

// 使用动态加载的数据源
const {
  displayedSongs,
  filteredSongs,
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
} = useSongsDataFromSource(sourceData);

// 表格列配置 - 简化版本，支持所有数据源
const defaultTableColumns = [
  {
    key: 'id', label: 'ID', sortable: true, width: '80px',
  },
  {
    key: 'title', label: '曲名', sortable: true, width: 'auto',
  },
  {
    key: 'artist', label: '艺术家', sortable: false, width: 'auto',
  },
  {
    key: 'difficulty', label: '难度', sortable: true, width: '80px',
  },
  {
    key: 'level', label: '等级', sortable: true, width: '60px',
  },
  {
    key: 'noteDesigner', label: '谱师', sortable: false, width: 'auto',
  },
];

const songsTableColumns = defaultTableColumns;

// 导出相关
const exportFormat = ref('csv');
const isExporting = ref(false);
const defaultExportColumns = songsTableColumns.map((col) => col.key);
const selectedExportColumns = ref([...defaultExportColumns]);
const columnLabelMap = Object.fromEntries(
  songsTableColumns.map((col) => [col.key, col.label]),
);
const hiddenDerivedExportColumns = new Set(['internalLevelNum', 'difficultyRank']);

Object.assign(columnLabelMap, {
  category: '分类',
  sheetType: '谱面类型',
  internalLevelValue: '详细定数',
});

const availableExportColumns = computed(() => {
  const allKeys = new Set(defaultExportColumns);

  filteredSongs.value.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!key.startsWith('_')) {
        allKeys.add(key);
      }
    });
  });

  hiddenDerivedExportColumns.forEach((key) => {
    allKeys.delete(key);
  });

  const rest = Array.from(allKeys)
    .filter((key) => !defaultExportColumns.includes(key))
    .sort((a, b) => a.localeCompare(b));

  return [...defaultExportColumns, ...rest];
});

const exportColumnOptions = computed(() => availableExportColumns.value.map((key) => ({
  key,
  label: columnLabelMap[key] || key,
})));

const exportHeaderLabels = computed(() => Object.fromEntries(
  exportColumnOptions.value.map((option) => [option.key, option.label]),
));

watch(availableExportColumns, (keys) => {
  const validKeys = new Set(keys);
  const filteredSelection = selectedExportColumns.value.filter((key) => validKeys.has(key));

  if (filteredSelection.length > 0) {
    if (filteredSelection.length !== selectedExportColumns.value.length) {
      selectedExportColumns.value = filteredSelection;
    }
    return;
  }

  const defaults = defaultExportColumns.filter((key) => validKeys.has(key));
  selectedExportColumns.value = defaults.length > 0 ? defaults : keys;
});

function setSort(newKey) {
  if (sortKey.value === newKey) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = newKey;
    sortDirection.value = 'asc';
  }
}

function resetFilters() {
  keyword.value = '';
  difficulty.value = '';
  level.value = '';
  minInternalLevel.value = '';
  maxInternalLevel.value = '';
  category.value = '';
  version.value = '';
  artistKeyword.value = '';
  noteDesignerKeyword.value = '';
  minBreak.value = '';
  maxBreak.value = '';
  sortKey.value = 'id';
  sortDirection.value = 'asc';
  page.value = 1;
}

function selectAllExportColumns() {
  selectedExportColumns.value = [...availableExportColumns.value];
}

function selectDefaultExportColumns() {
  selectedExportColumns.value = defaultExportColumns.filter((key) => availableExportColumns.value.includes(key));
}

function clearExportColumns() {
  selectedExportColumns.value = [];
}

async function handleExport() {
  if (pagination.value.total === 0) {
    // eslint-disable-next-line no-alert
    alert('没有数据可导出');
    return;
  }

  isExporting.value = true;
  try {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `dxdata-songs-${timestamp}`;

    const success = await exportData(
      filteredSongs.value,
      exportFormat.value,
      filename,
      {
        columns: selectedExportColumns.value,
        headers: exportHeaderLabels.value,
      },
    );
    if (!success && exportFormat.value === 'xlsx') {
      // eslint-disable-next-line no-alert
      alert('XLSX 库未安装，请运行: pnpm add xlsx');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Export error:', error);
    // eslint-disable-next-line no-alert
    alert('导出失败');
  } finally {
    isExporting.value = false;
  }
}

const sourceNames = {
  dxdata: 'DXData',
  diving_fish: 'Diving Fish',
  merged: '混合数据源',
};
</script>

<template>
  <div
    v-if="isLoading"
    class="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900"
  >
    <div class="text-center">
      <p class="text-slate-600 dark:text-slate-300">
        加载中...
      </p>
    </div>
  </div>

  <div
    v-else
    class="min-h-screen bg-slate-100 text-slate-800 transition-colors dark:bg-slate-900 dark:text-slate-100"
  >
    <!-- 头部 -->
    <header class="border-b border-slate-300/70 bg-white/70 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between p-4 md:px-6">
        <div>
          <h1 class="text-xl font-semibold md:text-2xl">
            {{ sourceNames[loadedSource] || '查询' }}
          </h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            乐曲列表
          </p>
        </div>

        <div class="flex items-center gap-2">
          <RouterLink
            to="/"
            class="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-200/80 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            切换数据源
          </RouterLink>
          <button
            class="rounded-md border border-slate-300 p-2 hover:bg-slate-200/80 dark:border-slate-700 dark:hover:bg-slate-800"
            @click="switchTheme()"
          >
            <span v-if="currentTheme === 'dark'">☾</span>
            <span v-else>☀</span>
          </button>
        </div>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <!-- 筛选面板 -->
      <section class="mb-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <!-- 曲名搜索 -->
          <label class="flex flex-col gap-1 text-sm">
            <span>曲名</span>
            <input
              v-model.trim="keyword"
              type="text"
              placeholder="输入曲名或别名"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
          </label>

          <!-- 难度筛选 -->
          <label class="flex flex-col gap-1 text-sm">
            <span>难度</span>
            <select
              v-model="difficulty"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">全部</option>
              <option>basic</option>
              <option>advanced</option>
              <option>expert</option>
              <option>master</option>
              <option>remaster</option>
            </select>
          </label>

          <!-- 等级筛选 -->
          <label class="flex flex-col gap-1 text-sm">
            <span>等级</span>
            <select
              v-model="level"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">全部</option>
              <option>1</option>
              <option>2</option>
              <option>3</option>
              <option>4</option>
              <option>5</option>
              <option>6</option>
              <option>7</option>
              <option>7+</option>
              <option>8</option>
              <option>8+</option>
              <option>9</option>
              <option>9+</option>
              <option>10</option>
              <option>10+</option>
              <option>11</option>
              <option>11+</option>
              <option>12</option>
              <option>12+</option>
              <option>13</option>
              <option>13+</option>
              <option>14</option>
              <option>14+</option>
              <option>15</option>
            </select>
          </label>

          <!-- 版本筛选 -->
          <label class="flex flex-col gap-1 text-sm">
            <span>版本</span>
            <select
              v-model="version"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">全部</option>
              <option
                v-for="v in versionsList"
                :key="v"
                :value="v"
              >
                {{ v }}
              </option>
            </select>
          </label>

          <!-- 分类 -->
          <label class="flex flex-col gap-1 text-sm">
            <span>分类</span>
            <input
              v-model.trim="category"
              type="text"
              placeholder="category..."
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
          </label>

          <!-- 艺术家 -->
          <label class="flex flex-col gap-1 text-sm">
            <span>艺术家</span>
            <input
              v-model.trim="artistKeyword"
              type="text"
              placeholder="artist contains..."
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
          </label>

          <!-- 谱师 -->
          <label class="flex flex-col gap-1 text-sm">
            <span>谱师</span>
            <input
              v-model.trim="noteDesignerKeyword"
              type="text"
              placeholder="noteDesigner contains..."
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
          </label>

          <!-- 定数范围 -->
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1 text-sm">
              <span>定数最小</span>
              <input
                v-model.number="minInternalLevel"
                type="number"
                step="0.1"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
              >
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span>定数最大</span>
              <input
                v-model.number="maxInternalLevel"
                type="number"
                step="0.1"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
              >
            </label>
          </div>

          <!-- BREAK数范围 -->
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1 text-sm">
              <span>BREAK数最小</span>
              <input
                v-model.number="minBreak"
                type="number"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
              >
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span>BREAK数最大</span>
              <input
                v-model.number="maxBreak"
                type="number"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
              >
            </label>
          </div>
        </div>

        <!-- 按钮 -->
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
            @click="resetFilters"
          >
            重置筛选
          </button>
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-200/50 dark:border-slate-600 dark:hover:bg-slate-700/50"
            @click="selectAllExportColumns"
          >
            全选导出列
          </button>
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-200/50 dark:border-slate-600 dark:hover:bg-slate-700/50"
            @click="selectDefaultExportColumns"
          >
            恢复默认列
          </button>
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-200/50 dark:border-slate-600 dark:hover:bg-slate-700/50"
            @click="clearExportColumns"
          >
            清空导出列
          </button>
        </div>
      </section>

      <!-- 统计信息 -->
      <div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p class="text-xs text-slate-600 dark:text-slate-400">
            歌曲数
          </p>
          <p class="text-xl font-bold text-slate-900 dark:text-white">
            {{ statistics.totalSongs }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p class="text-xs text-slate-600 dark:text-slate-400">
            谱面数
          </p>
          <p class="text-xl font-bold text-slate-900 dark:text-white">
            {{ statistics.totalSheets }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p class="text-xs text-slate-600 dark:text-slate-400">
            最高等级
          </p>
          <p class="text-xl font-bold text-slate-900 dark:text-white">
            {{ statistics.maxLevel }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p class="text-xs text-slate-600 dark:text-slate-400">
            Basic数
          </p>
          <p class="text-xl font-bold text-slate-900 dark:text-white">
            {{ statistics.basic }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p class="text-xs text-slate-600 dark:text-slate-400">
            Master数
          </p>
          <p class="text-xl font-bold text-slate-900 dark:text-white">
            {{ statistics.master }}
          </p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <p class="text-xs text-slate-600 dark:text-slate-400">
            Remaster数
          </p>
          <p class="text-xl font-bold text-slate-900 dark:text-white">
            {{ statistics.remaster }}
          </p>
        </div>
      </div>

      <!-- 导出面板 -->
      <section class="mb-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div class="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
          <label class="flex flex-col gap-1 text-sm">
            <span>导出格式</span>
            <select
              v-model="exportFormat"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
              <option value="xlsx">Excel (.xlsx)</option>
            </select>
          </label>

          <button
            class="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            :disabled="isExporting || pagination.total === 0"
            @click="handleExport"
          >
            {{ isExporting ? '导出中...' : '导出数据' }}
          </button>
        </div>

        <!-- 导出列选择 -->
        <div class="max-h-64 overflow-y-auto rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900">
          <div class="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            <label
              v-for="col in exportColumnOptions"
              :key="col.key"
              class="flex items-center gap-2 text-sm"
            >
              <input
                v-model="selectedExportColumns"
                type="checkbox"
                :value="col.key"
                class="rounded border-slate-300"
              >
              <span>{{ col.label }}</span>
            </label>
          </div>
        </div>
      </section>

      <!-- 数据表 -->
      <section class="rounded-xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <SongsDataTable
          v-if="displayedSongs.length > 0"
          :songs="displayedSongs"
          :columns="songsTableColumns"
          :sort-key="sortKey"
          :sort-direction="sortDirection"
          @sort="setSort"
        />
        <div
          v-else
          class="p-8 text-center text-slate-600 dark:text-slate-300"
        >
          没有找到匹配的数据
        </div>
      </section>

      <!-- 分页 -->
      <div class="mt-4 flex items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div class="text-sm text-slate-600 dark:text-slate-300">
          共 <strong>{{ pagination.total }}</strong> 条，
          {{ pagination.startIndex }} 至 {{ pagination.endIndex }}
        </div>

        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-600 dark:text-slate-300">
            页: {{ pagination.currentPage }} / {{ pagination.totalPages }}
          </span>

          <button
            :disabled="!pagination.hasPrevPage"
            class="rounded border border-slate-300 px-3 py-1 disabled:opacity-50 dark:border-slate-600"
            @click="page -= 1"
          >
            上一页
          </button>

          <button
            :disabled="!pagination.hasNextPage"
            class="rounded border border-slate-300 px-3 py-1 disabled:opacity-50 dark:border-slate-600"
            @click="page += 1"
          >
            下一页
          </button>

          <select
            v-model.number="pageSize"
            class="ml-2 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
          >
            <option
              v-for="size in pageSizeOptions"
              :key="size"
              :value="size"
            >
              {{ size }} / 页
            </option>
          </select>
        </div>
      </div>
    </main>
  </div>
</template>
