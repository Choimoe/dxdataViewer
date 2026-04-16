<script setup>
import { ref, onMounted } from 'vue';
import useTheme from '@/composables/useTheme.js';

const { currentTheme, switchTheme } = useTheme();

const mergeStatus = ref({
  lastMergedTime: null,
  sourceStatuses: {
    maichart: { status: 'unknown', lastFetchTime: null },
    dxdata: { status: 'unknown', lastFetchTime: null },
    divingFish: { status: 'unknown', lastFetchTime: null },
  },
  totalSongs: 0,
  totalSheets: 0,
  mergeHealth: 'unknown', // 'healthy', 'warning', 'error'
});

onMounted(async () => {
  try {
    // Try different paths for dev and prod
    const basePath = import.meta.env.VITE_BASE_PUBLIC_PATH || '/dxdataViewer/';
    const paths = [
      `${basePath.replace(/\/$/, '')}/data/raw/merged/merged-data.json`,
      '/data/raw/merged/merged-data.json',
      './data/raw/merged/merged-data.json',
    ];

    // Try all paths in parallel using Promise.allSettled
    const results = await Promise.allSettled(paths.map((path) => fetch(path)));

    const okResult = results.find((result) => result.status === 'fulfilled' && result.value.ok);
    const response = okResult?.value;

    if (response) {
      const data = await response.json();

      if (data.metadata) {
        mergeStatus.value.lastMergedTime = data.metadata.mergedAt;
        if (data.metadata.sources) {
          Object.assign(mergeStatus.value.sourceStatuses, data.metadata.sources);
        }
      }

      mergeStatus.value.totalSongs = data.songs?.length || 0;
      mergeStatus.value.totalSheets = data.songs?.reduce(
        (sum, song) => sum + (song.sheets?.length || 0),
        0,
      ) || 0;

      // 评估合并健康度
      const sourcesList = Object.values(mergeStatus.value.sourceStatuses);
      const healthySources = sourcesList.filter((s) => s.status === 'healthy').length;
      if (healthySources === 3) {
        mergeStatus.value.mergeHealth = 'healthy';
      } else if (healthySources >= 2) {
        mergeStatus.value.mergeHealth = 'warning';
      } else {
        mergeStatus.value.mergeHealth = 'error';
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load merge status:', error);
    mergeStatus.value.mergeHealth = 'error';
  }
});

function formatTime(isoString) {
  if (!isoString) return '未知';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN');
  } catch {
    return '无效时间';
  }
}

function getStatusColor(status) {
  const colors = {
    healthy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  };
  return colors[status] || colors.unknown;
}

function getStatusLabel(status) {
  const labels = {
    healthy: '正常',
    warning: '警告',
    error: '错误',
    unknown: '未知',
  };
  return labels[status] || '未知';
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 transition-colors dark:bg-slate-900 dark:text-slate-100">
    <header class="border-b border-slate-300/70 bg-white/70 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between p-4 md:px-6">
        <div>
          <h1 class="text-xl font-semibold md:text-2xl">合并数据状态</h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">Merge Status</p>
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
      <!-- 总体健康度 -->
      <section class="mb-6 rounded-xl border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h2 class="mb-4 text-lg font-semibold">
              总体状态
            </h2>
            <div class="flex items-center gap-3">
              <div :class="`inline-block rounded-full px-4 py-2 text-sm font-semibold ${getStatusColor(mergeStatus.mergeHealth)}`">
                {{ getStatusLabel(mergeStatus.mergeHealth) }}
              </div>
            </div>
          </div>
          <div>
            <h3 class="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-400">最后更新时间</h3>
            <p class="text-sm">{{ formatTime(mergeStatus.lastMergedTime) }}</p>
          </div>
        </div>
      </section>

      <!-- 数据源状态 -->
      <section class="mb-6 rounded-xl border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <h2 class="mb-4 text-lg font-semibold">
          数据源状态
        </h2>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div
            v-for="(sourceStatus, sourceName) in mergeStatus.sourceStatuses"
            :key="sourceName"
            class="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
          >
            <div class="mb-3 flex items-center justify-between">
              <h3 class="font-semibold capitalize">
              {{
                sourceName === 'divingFish'
                  ? 'Diving Fish'
                  : sourceName === 'dxdata'
                    ? 'DXData'
                    : 'MaiChart'
              }}
            </h3>
              <span :class="`rounded px-2 py-1 text-xs font-semibold ${getStatusColor(sourceStatus.status)}`">
                {{ getStatusLabel(sourceStatus.status) }}
              </span>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              <span class="font-medium">上次获取:</span><br>
              {{ formatTime(sourceStatus.lastFetchTime) }}
            </p>
          </div>
        </div>
      </section>

      <!-- 统计信息 -->
      <section class="rounded-xl border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
        <h2 class="mb-4 text-lg font-semibold">
          数据统计
        </h2>
        <div class="grid grid-cols-2 gap-4 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p class="text-sm text-slate-600 dark:text-slate-400">总曲数</p>
            <p class="text-2xl font-bold">{{ mergeStatus.totalSongs }}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <p class="text-sm text-slate-600 dark:text-slate-400">总谱面数</p>
            <p class="text-2xl font-bold">{{ mergeStatus.totalSheets }}</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
