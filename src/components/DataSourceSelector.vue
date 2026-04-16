<script setup>
import { computed } from 'vue';

const props = defineProps({
  sources: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['select']);

const sourceKeys = computed(() => Object.keys(props.sources));

const handleSelect = (sourceKey) => {
  emit('select', sourceKey);
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
    <!-- 头部 -->
    <header class="border-b border-slate-200/70 bg-white/50 backdrop-blur dark:border-slate-700 dark:bg-slate-900/50">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between p-4 md:px-6">
        <div>
          <h1 class="text-xl font-bold md:text-2xl text-slate-900 dark:text-white">
            DXData Viewer
          </h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            谱面数据查询系统
          </p>
        </div>

        <div class="text-right">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            选择数据源开始
          </p>
        </div>
      </div>
    </header>

    <!-- 主要内容 -->
    <main class="mx-auto w-full max-w-6xl px-4 py-12 md:px-6">
      <div class="mb-12 text-center">
        <h2 class="text-4xl font-bold text-slate-900 dark:text-white">
          选择数据源
        </h2>
        <p class="mt-4 text-lg text-slate-600 dark:text-slate-300">
          选择您要浏览的数据源，首次加载将下载对应的数据
        </p>
      </div>

      <!-- 数据源卡片网格 -->
      <div class="grid gap-6 md:grid-cols-3">
        <button
          v-for="key in sourceKeys"
          :key="key"
          class="group relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-8 transition-all hover:border-indigo-500 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-400"
          @click="handleSelect(key)"
        >
          <!-- 背景渐变 -->
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-indigo-900/20" />

          <!-- 内容 -->
          <div class="relative z-10 text-left">
            <!-- 标题 -->
            <h3 class="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
              {{ sources[key].name }}
            </h3>

            <!-- 描述 -->
            <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
              {{ sources[key].description }}
            </p>

            <!-- 大小信息 -->
            <div class="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/50">
              <span class="text-xs font-medium text-slate-600 dark:text-slate-400">
                文件大小:
              </span>
              <span class="font-semibold text-slate-900 dark:text-white">
                {{ sources[key].size }}
              </span>
            </div>

            <!-- 点击提示 -->
            <div class="mt-6 flex items-center gap-2 font-medium text-indigo-600 group-hover:gap-3 transition-all dark:text-indigo-400">
              <span>点击加载</span>
              <span class="transition group-hover:translate-x-1">→</span>
            </div>
          </div>
        </button>
      </div>

      <div class="mt-6 rounded-2xl border-2 border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 class="text-xl font-bold text-slate-900 dark:text-white">
              实用工具
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              从 CSV 或文本批量输入歌曲 ID，自动下载 diving-fish 封面并打包 ZIP。
            </p>
          </div>

          <RouterLink
            to="/covers"
            class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            打开封面批量下载
          </RouterLink>
        </div>
      </div>

      <!-- 提示 -->
      <div class="mt-12 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <p class="text-sm text-blue-900 dark:text-blue-200">
          <strong>💡 提示：</strong>
          推荐使用"混合数据源"，它统合了所有数据源的信息，提供最完整的谱师数据和谱面信息。
        </p>
      </div>
    </main>
  </div>
</template>
