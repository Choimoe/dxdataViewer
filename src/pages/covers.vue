<script setup>
import { computed, ref } from 'vue';
import useTheme from '@/composables/useTheme.js';
import useCoverDownloader from '@/composables/useCoverDownloader.js';

const { currentTheme, switchTheme } = useTheme();
const {
  parseIdsFromText,
  parseIdsFromCsvText,
  uniqueIds,
  downloadCoversAsZip,
  triggerBlobDownload,
} = useCoverDownloader();

const rawIdInput = ref('');
const csvFile = ref(null);
const csvIds = ref([]);
const csvError = ref('');

const isDownloading = ref(false);
const progress = ref({
  state: 'idle',
  total: 0,
  completed: 0,
  success: 0,
  failed: 0,
  currentId: null,
});

const failedItems = ref([]);
const summary = ref(null);

const textIds = computed(() => parseIdsFromText(rawIdInput.value));
const allIds = computed(() => uniqueIds([...textIds.value, ...csvIds.value]));
const progressPercent = computed(() => {
  if (!progress.value.total) {
    return 0;
  }
  return Math.round((progress.value.completed / progress.value.total) * 100);
});

async function handleCsvChange(event) {
  csvError.value = '';
  csvIds.value = [];
  summary.value = null;

  const file = event.target.files?.[0];
  csvFile.value = file || null;

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = await parseIdsFromCsvText(text);
    if (parsed.length === 0) {
      csvError.value = 'CSV 未找到 ID 列，或 ID 列没有可用数字。';
      return;
    }
    csvIds.value = parsed;
  } catch (error) {
    csvError.value = `CSV 解析失败: ${error instanceof Error ? error.message : '未知错误'}`;
  }
}

function resetResult() {
  failedItems.value = [];
  summary.value = null;
}

async function startDownload() {
  const ids = allIds.value;
  if (ids.length === 0) {
    // eslint-disable-next-line no-alert
    alert('请先输入 ID，或上传包含 ID 列的 CSV');
    return;
  }

  resetResult();
  isDownloading.value = true;

  try {
    const result = await downloadCoversAsZip(ids, {
      concurrency: 6,
      onProgress: (nextProgress) => {
        progress.value = nextProgress;
      },
    });

    failedItems.value = result.failed;
    summary.value = {
      total: result.total,
      success: result.success,
      failed: result.failed.length,
    };

    if (result.blob && result.success > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      triggerBlobDownload(result.blob, `diving-fish-covers-${timestamp}.zip`);
    }

    if (result.success === 0) {
      // eslint-disable-next-line no-alert
      alert('没有成功下载到任何封面，请检查 ID 或稍后重试。');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line no-alert
    alert(`下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
  } finally {
    isDownloading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 transition-colors dark:bg-slate-900 dark:text-slate-100">
    <header class="border-b border-slate-300/70 bg-white/70 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between p-4 md:px-6">
        <div>
          <h1 class="text-xl font-semibold md:text-2xl">
            封面批量下载
          </h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            从 CSV 或文本批量提取 ID，下载 diving-fish 封面并打包 ZIP
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

    <main class="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 md:px-6">
      <section class="rounded-xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <h2 class="mb-2 text-base font-semibold">
          方式 1：批量输入 ID
        </h2>
        <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
          支持分隔符：中英文逗号、顿号、竖线、换行、空格
        </p>
        <textarea
          v-model="rawIdInput"
          :disabled="isDownloading"
          rows="6"
          class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
          placeholder="示例: 38, 11466、123 | 10038\n777 888"
        />
        <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          文本解析到 {{ textIds.length }} 个 ID
        </p>
      </section>

      <section class="rounded-xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <h2 class="mb-2 text-base font-semibold">
          方式 2：上传 CSV
        </h2>
        <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">
          自动读取第一张表，要求存在列名为 ID 的列（不区分大小写）
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          :disabled="isDownloading"
          class="block w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
          @change="handleCsvChange"
        >

        <p
          v-if="csvFile"
          class="mt-2 text-xs text-slate-500 dark:text-slate-400"
        >
          已选择: {{ csvFile.name }}
        </p>
        <p
          v-if="csvError"
          class="mt-2 text-xs text-red-500"
        >
          {{ csvError }}
        </p>
        <p
          v-else-if="csvIds.length > 0"
          class="mt-2 text-xs text-slate-500 dark:text-slate-400"
        >
          CSV 解析到 {{ csvIds.length }} 个 ID
        </p>
      </section>

      <section class="rounded-xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="rounded-md border border-indigo-500 bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-600 disabled:border-slate-300 disabled:bg-slate-300 dark:disabled:border-slate-600 dark:disabled:bg-slate-600"
            :disabled="isDownloading || allIds.length === 0"
            @click="startDownload"
          >
            {{ isDownloading ? '下载中...' : `下载并打包 ZIP（${allIds.length} 个唯一 ID）` }}
          </button>

          <span class="text-xs text-slate-500 dark:text-slate-400">
            同名 ID 会自动去重
          </span>
        </div>

        <div
          v-if="isDownloading || summary"
          class="mt-4"
        >
          <div class="mb-2 flex items-center justify-between text-sm">
            <span>进度: {{ progress.completed }}/{{ progress.total }}</span>
            <span>{{ progressPercent }}%</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              class="h-full bg-indigo-500 transition-all"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>

          <div class="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
            <span>成功: {{ progress.success }}</span>
            <span>失败: {{ progress.failed }}</span>
            <span v-if="progress.currentId !== null">当前 ID: {{ progress.currentId }}</span>
          </div>

          <div
            v-if="summary"
            class="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            本次完成：共 {{ summary.total }}，成功 {{ summary.success }}，失败 {{ summary.failed }}
          </div>

          <div
            v-if="failedItems.length > 0"
            class="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            <p class="font-medium">
              失败 ID（最多展示前 20 项）
            </p>
            <p class="mt-1 break-all">
              {{ failedItems.slice(0, 20).map((item) => `${item.id}(${item.message})`).join('，') }}
            </p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
