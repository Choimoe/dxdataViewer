<script setup>
import { computed, ref, watch } from 'vue';
import SongsDataTable from '@/components/songs/SongsDataTable.vue';
import MergedDataFooter from '@/components/layout/MergedDataFooter.vue';
import useSongsTable, { songsTableColumns } from '@/composables/useSongsTable.js';
import useExportData from '@/composables/useExportData.js';
import useTheme from '@/composables/useTheme.js';

const { currentTheme, switchTheme } = useTheme();
const { exportData } = useExportData();

// 导出相关状态
const exportFormat = ref('csv');
const isExporting = ref(false);

const defaultExportColumns = songsTableColumns.map((col) => col.key);
const selectedExportColumns = ref([...defaultExportColumns]);
const columnLabelMap = Object.fromEntries(songsTableColumns.map((col) => [col.key, col.label]));

Object.assign(columnLabelMap, {
  songId: '歌曲ID',
  searchAcronyms: '搜索别名',
  levelNum: '等级数值',
  internalLevelNum: '定数数值',
  noteBreakNum: 'Break 数值',
  difficultyRank: '难度排序值',
  sourceRecords: '来源记录',
  fieldRules: '字段规则',
  titleDxdata: '曲名(dxdata)',
  titleDivingFish: '曲名(diving-fish)',
});

const {
  dataSource,
  dataSourceOptions,
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
  sortedSongs,
  setSort,
  resetFilters,
} = useSongsTable();

const availableExportColumns = computed(() => {
  const allKeys = new Set(defaultExportColumns);

  sortedSongs.value.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!key.startsWith('_')) {
        allKeys.add(key);
      }
    });
  });

  const rest = Array.from(allKeys).filter((key) => !defaultExportColumns.includes(key));
  rest.sort((a, b) => a.localeCompare(b));

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
}, { immediate: true });

function selectAllExportColumns() {
  selectedExportColumns.value = [...availableExportColumns.value];
}

function selectDefaultExportColumns() {
  selectedExportColumns.value = defaultExportColumns.filter((key) => availableExportColumns.value.includes(key));
}

function clearExportColumns() {
  selectedExportColumns.value = [];
}

/**
 * 导出当前筛选的结果
 */
async function handleExport() {
  if (total.value === 0) {
    // eslint-disable-next-line no-alert
    alert('没有数据可导出');
    return;
  }

  isExporting.value = true;
  try {
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `dxdata-songs-${timestamp}`;

    const success = await exportData(sortedSongs.value, exportFormat.value, filename, {
      columns: selectedExportColumns.value,
      headers: exportHeaderLabels.value,
    });
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
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 transition-colors dark:bg-slate-900 dark:text-slate-100">
    <header class="border-b border-slate-300/70 bg-white/70 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between p-4 md:px-6">
        <div>
          <h1 class="text-xl font-semibold md:text-2xl">
            DX Songs
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
            返回入口
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

    <main class="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <section class="mb-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label class="flex flex-col gap-1 text-sm">
            <span>数据源</span>
            <select
              v-model="dataSource"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option
                v-for="item in dataSourceOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span>曲名</span>
            <input
              v-model.trim="keyword"
              type="text"
              placeholder="输入曲名或别名"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span>难度</span>
            <select
              v-model="difficulty"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">
                全部
              </option>
              <option
                v-for="item in difficultyOptions"
                :key="item"
                :value="item"
              >
                {{ item }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span>等级</span>
            <select
              v-model="level"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">
                全部
              </option>
              <option
                v-for="item in levelOptions"
                :key="item"
                :value="item"
              >
                {{ item }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span>分类</span>
            <select
              v-model="category"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">
                全部
              </option>
              <option
                v-for="item in categoryOptions"
                :key="item"
                :value="item"
              >
                {{ item }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span>版本</span>
            <select
              v-model="version"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">
                全部
              </option>
              <option
                v-for="item in versionOptions"
                :key="item"
                :value="item"
              >
                {{ item }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span>类型</span>
            <select
              v-model="sheetType"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">
                全部
              </option>
              <option
                v-for="item in sheetTypeOptions"
                :key="item"
                :value="item"
              >
                {{ item }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span>艺术家</span>
            <input
              v-model.trim="artistKeyword"
              type="text"
              placeholder="artist contains..."
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span>谱师</span>
            <input
              v-model.trim="noteDesignerKeyword"
              type="text"
              placeholder="noteDesigner contains..."
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
          </label>

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

          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1 text-sm">
              <span>Break 最小值</span>
              <input
                v-model.number="minBreak"
                type="number"
                min="0"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
              >
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span>Break 最大值</span>
              <input
                v-model.number="maxBreak"
                type="number"
                min="0"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
              >
            </label>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <button
            class="rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
            @click="resetFilters"
          >
            重置筛选
          </button>
          <span class="text-slate-600 dark:text-slate-300">当前结果：{{ total }} 条</span>
        </div>
      </section>

      <!-- 导出选项 -->
      <section class="mb-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1 text-sm">
            <span>导出格式</span>
            <select
              v-model="exportFormat"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-indigo-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="csv">
                CSV (Excel 兼容)
              </option>
              <option value="txt">
                TXT (制表符分隔)
              </option>
              <option value="xlsx">
                XLSX (Excel 格式)
              </option>
            </select>
          </label>

          <button
            :disabled="isExporting || total === 0 || selectedExportColumns.length === 0"
            class="rounded-md border border-indigo-500 bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600 disabled:border-slate-300 disabled:bg-slate-300 dark:disabled:border-slate-600 dark:disabled:bg-slate-600"
            @click="handleExport"
          >
            <span v-if="!isExporting">
              导出当前筛选 ({{ total }} 条)
            </span>
            <span v-else>
              导出中...
            </span>
          </button>

          <span class="text-xs text-slate-500 dark:text-slate-400">
            导出整个筛选结果，不受分页限制
          </span>

          <span
            v-if="selectedExportColumns.length === 0"
            class="text-xs text-red-500"
          >
            请至少选择 1 列导出
          </span>
        </div>

        <details
          class="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
        >
          <summary class="cursor-pointer select-none text-sm font-medium">
            高级导出选项（默认与网页表格一致）
          </summary>

          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              class="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              @click="selectDefaultExportColumns"
            >
              仅表格列
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              @click="selectAllExportColumns"
            >
              全选
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              @click="clearExportColumns"
            >
              清空
            </button>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            <label
              v-for="option in exportColumnOptions"
              :key="option.key"
              class="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-sm dark:border-slate-700"
            >
              <input
                v-model="selectedExportColumns"
                type="checkbox"
                :value="option.key"
              >
              <span>{{ option.label }}</span>
              <span class="text-xs text-slate-500 dark:text-slate-400">({{ option.key }})</span>
            </label>
          </div>
        </details>
      </section>

      <SongsDataTable
        :columns="songsTableColumns"
        :rows="pagedSongs"
        :sort-key="sortKey"
        :sort-direction="sortDirection"
        :page="page"
        :page-size="pageSize"
        :page-size-options="pageSizeOptions"
        :total-pages="totalPages"
        :total="total"
        @set-sort="setSort"
        @update:page="page = $event"
        @update:page-size="pageSize = $event"
      />
    </main>

    <MergedDataFooter />
  </div>
</template>
