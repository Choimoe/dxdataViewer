<script setup>
import { ref, onMounted } from 'vue';

const mergeStatus = ref({
  lastMergedTime: null,
  status: 'loading',
  totalSongs: 0,
  sourceReady: { maichart: false, dxdata: false, divingFish: false },
});

onMounted(async () => {
  try {
    const response = await fetch('/data/raw/merged/merged-data.json?raw');
    if (response.ok) {
      const data = await response.json();

      if (data.metadata?.mergedAt) {
        mergeStatus.value.lastMergedTime = new Date(data.metadata.mergedAt);
      }

      mergeStatus.value.totalSongs = data.songs?.length || 0;
      mergeStatus.value.status = 'ready';

      // 检查数据源
      if (data.metadata?.sources) {
        mergeStatus.value.sourceReady = {
          maichart: !!data.metadata.sources.maichart,
          dxdata: !!data.metadata.sources.dxdata,
          divingFish: !!data.metadata.sources.divingFish,
        };
      }
    } else {
      mergeStatus.value.status = 'error';
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load merge status:', error);
    mergeStatus.value.status = 'error';
  }
});

function getStatusIcon() {
  if (mergeStatus.value.status === 'ready') {
    return '✓';
  }
  if (mergeStatus.value.status === 'loading') {
    return '⟳';
  }
  return '✕';
}

function getStatusColor() {
  const colors = {
    ready: 'text-green-600 dark:text-green-400',
    loading: 'text-slate-500 dark:text-slate-400',
    error: 'text-red-600 dark:text-red-400',
  };
  return colors[mergeStatus.value.status] || colors.loading;
}

function formatTime(date) {
  if (!date) return '未获取';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <footer class="border-t border-slate-300 bg-white/70 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
    <div class="mx-auto w-full max-w-7xl px-4 py-4 md:px-6">
      <div class="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div class="flex items-center gap-3 text-sm">
          <span :class="`text-2xl transition-transform ${mergeStatus.status === 'loading' ? 'animate-spin' : ''} ${getStatusColor()}`">
            {{ getStatusIcon() }}
          </span>
          <div>
            <p class="font-medium">
              合并数据: {{ mergeStatus.status === 'ready' ? '就绪' : mergeStatus.status === 'loading' ? '加载中' : '出错' }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              更新时间: {{ formatTime(mergeStatus.lastMergedTime) }} |
              包含 {{ mergeStatus.totalSongs }} 首曲
            </p>
          </div>
        </div>
        <RouterLink
          to="/status"
          class="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          查看详情 →
        </RouterLink>
      </div>
    </div>
  </footer>
</template>
