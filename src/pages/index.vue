<script setup>
const { currentTheme, switchTheme } = useTheme();

const pages = [
  {
    title: 'Songs 展示',
    description: '进入 songs 数据筛选、排序、分页界面',
    path: '/songs',
    cta: '进入 Songs 页面',
  },
  {
    title: '混合数据源',
    description: '综合三个数据源（maichart ID + dxdata 谱面 + diving-fish 谱师），填补空缺数据',
    path: '/merged',
    cta: '进入混合数据源页面',
  },
];
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

    <main class="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 md:grid-cols-2 md:px-6">
      <RouterLink
        v-for="item in pages"
        :key="item.path"
        :to="item.path"
        class="group rounded-xl border border-slate-300 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/60"
      >
        <h2 class="text-lg font-semibold">
          {{ item.title }}
        </h2>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {{ item.description }}
        </p>
        <p class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-300">
          {{ item.cta }}
          <span class="transition group-hover:translate-x-0.5">→</span>
        </p>
      </RouterLink>
    </main>
  </div>
</template>
