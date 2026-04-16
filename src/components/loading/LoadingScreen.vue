<script setup>
defineProps({
  progress: {
    type: Number,
    default: 0,
  },
  source: {
    type: String,
    default: '',
  },
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
    <div class="w-full max-w-md px-6 py-12">
      <div class="rounded-2xl bg-white/80 backdrop-blur dark:bg-slate-800/80 p-8 shadow-xl">
        <!-- 标题 -->
        <div class="mb-8 text-center">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">
            加载中...
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            正在加载 {{ source }} 数据源
          </p>
        </div>

        <!-- 进度条 -->
        <div class="mb-6 space-y-2">
          <div class="relative h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              class="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300 ease-out"
              :style="{ width: `${progress}%` }"
            />
          </div>
          <p class="text-center text-sm font-medium text-slate-600 dark:text-slate-300">
            {{ progress }}%
          </p>
        </div>

        <!-- 加载动画 -->
        <div class="flex justify-center gap-2">
          <div class="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 0s" />
          <div class="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 0.15s" />
          <div class="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 0.3s" />
        </div>

        <!-- 提示语 -->
        <p class="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          首次加载需要一些时间，请耐心等待...
        </p>
      </div>
    </div>
  </div>
</template>
