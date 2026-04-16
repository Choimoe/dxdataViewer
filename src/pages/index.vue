<script setup>
import useTheme from '@/composables/useTheme.js';

const { currentTheme, switchTheme } = useTheme();
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 transition-colors dark:bg-slate-900 dark:text-slate-100">
    <header class="border-b border-slate-300/70 bg-white/70 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
      <div class="mx-auto flex w-full max-w-7xl items-center justify-between p-4 md:px-6">
        <div>
          <h1 class="text-xl font-semibold md:text-2xl">
            DXData Viewer
          </h1>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            主页
          </p>
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

    <main class="mx-auto w-full max-w-7xl px-4 py-12 md:px-6">
      <div class="flex flex-col items-center gap-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold">谱面数据查询系统</h2>
          <p class="mt-2 text-lg text-slate-600 dark:text-slate-300">支持 DXData、Diving Fish 和混合数据源</p>
        </div>

        <RouterLink
          to="/songs"
          class="group rounded-xl border-2 border-indigo-500 bg-indigo-50 px-8 py-6 text-center shadow-lg transition hover:-translate-y-1 hover:shadow-xl dark:border-indigo-400 dark:bg-indigo-900/20"
        >
          <h3 class="text-2xl font-semibold text-indigo-600 dark:text-indigo-300">
            进入查询
          </h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            开始筛选、排序和导出谱面数据
          </p>
          <p class="mt-4 inline-flex items-center gap-2 font-medium text-indigo-600 dark:text-indigo-300">
            点击进入
            <span class="transition group-hover:translate-x-1">→</span>
          </p>
        </RouterLink>
      </div>
    </main>
  </div>
</template>
