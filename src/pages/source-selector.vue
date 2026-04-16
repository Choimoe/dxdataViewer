<script setup>
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import DataSourceSelector from '@/components/DataSourceSelector.vue';
import LoadingScreen from '@/components/loading/LoadingScreen.vue';
import useLazyDataLoader from '@/composables/useLazyDataLoader.js';
import { clearLoadedSourceData, setLoadedSourceData } from '@/stores/loadedDataStore.js';
import useTheme from '@/composables/useTheme.js';

const { currentTheme, switchTheme } = useTheme();
const router = useRouter();
const {
  loadingProgress,
  isLoading,
  error,
  data,
  currentSource,
  dataSourceInfo,
  loadData,
  clearData,
} = useLazyDataLoader();

const showError = ref(false);

// 处理数据源选择
const handleSelectSource = async (sourceKey) => {
  showError.value = false;
  await loadData(sourceKey);

  // 数据加载完成后跳转到查询页面
  if (data.value && !error.value) {
    setLoadedSourceData(sourceKey, data.value);

    // 跳转到查询页面
    router.push('/query');
  } else {
    showError.value = true;
  }
};

// 处理错误消息
const errorMessage = computed(() => {
  if (!error.value) return '';
  return error.value;
});

onMounted(() => {
  clearData();
  clearLoadedSourceData();
});
</script>

<template>
  <!-- 查询页面加载中 -->
  <div
    v-if="isLoading"
    class="relative"
  >
    <LoadingScreen
      :progress="loadingProgress"
      :source="currentSource || ''"
    />
  </div>

  <!-- 错误显示 -->
  <div
    v-else-if="showError"
    class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
  >
    <header class="border-b border-slate-200/70 bg-white/50 backdrop-blur dark:border-slate-700 dark:bg-slate-900/50">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between p-4 md:px-6">
        <h1 class="text-xl font-bold text-slate-900 dark:text-white md:text-2xl">
          DXData Viewer
        </h1>
        <button
          class="rounded-md border border-slate-300 p-2 hover:bg-slate-200/80 dark:border-slate-700 dark:hover:bg-slate-800"
          @click="switchTheme()"
        >
          <span v-if="currentTheme === 'dark'">☾</span>
          <span v-else>☀</span>
        </button>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
      <div class="rounded-xl border-2 border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <h2 class="text-lg font-bold text-red-900 dark:text-red-200">
          加载失败
        </h2>
        <p class="mt-2 text-red-800 dark:text-red-300">
          {{ errorMessage }}
        </p>
        <button
          class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          @click="showError = false"
        >
          返回重试
        </button>
      </div>
    </main>
  </div>

  <!-- 数据源选择屏幕 -->
  <div
    v-else
    class="flex flex-col"
  >
    <header class="border-b border-slate-200/70 bg-white/50 backdrop-blur dark:border-slate-700 dark:bg-slate-900/50">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between p-4 md:px-6">
        <div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-white md:text-2xl">
            DXData Viewer
          </h1>
        </div>
        <button
          class="rounded-md border border-slate-300 p-2 hover:bg-slate-200/80 dark:border-slate-700 dark:hover:bg-slate-800"
          @click="switchTheme()"
        >
          <span v-if="currentTheme === 'dark'">☾</span>
          <span v-else>☀</span>
        </button>
      </div>
    </header>

    <div class="flex-1">
      <DataSourceSelector
        :sources="dataSourceInfo"
        @select="handleSelectSource"
      />
    </div>
  </div>
</template>
