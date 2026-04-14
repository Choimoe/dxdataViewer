<script setup>
const props = defineProps({
  columns: {
    type: Array,
    required: true,
  },
  rows: {
    type: Array,
    required: true,
  },
  sortKey: {
    type: String,
    required: true,
  },
  sortDirection: {
    type: String,
    required: true,
  },
  page: {
    type: Number,
    required: true,
  },
  pageSize: {
    type: Number,
    required: true,
  },
  pageSizeOptions: {
    type: Array,
    required: true,
  },
  totalPages: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['set-sort', 'update:page', 'update:page-size']);

function prevPage() {
  emit('update:page', Math.max(1, props.page - 1));
}

function nextPage() {
  emit('update:page', Math.min(props.totalPages, props.page + 1));
}

function onPageSizeChange(event) {
  emit('update:page-size', Number(event.target.value));
}
</script>

<template>
  <section class="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-100 dark:bg-slate-900/70">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="whitespace-nowrap px-3 py-2 text-left font-semibold"
            >
              <button
                class="inline-flex items-center gap-1 hover:opacity-80"
                @click="emit('set-sort', col.key)"
              >
                <span>{{ col.label }}</span>
                <span
                  v-if="sortKey === col.key"
                  class="text-xs"
                >
                  {{ sortDirection === 'asc' ? '▲' : '▼' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="song in rows"
            :key="song._rowId"
            class="border-t border-slate-200 dark:border-slate-700"
          >
            <td class="px-3 py-2">
              {{ song.internalId }}
            </td>
            <td class="px-3 py-2">
              {{ song.title }}
            </td>
            <td class="px-3 py-2">
              {{ song.artist }}
            </td>
            <td class="px-3 py-2 uppercase">
              {{ song.sheetType }}
            </td>
            <td class="px-3 py-2">
              {{ song.difficulty }}
            </td>
            <td class="px-3 py-2">
              {{ song.level }}
            </td>
            <td class="px-3 py-2">
              {{ song.internalLevelValue }}
            </td>
            <td class="px-3 py-2">
              {{ song.noteDesigner }}
            </td>
            <td class="px-3 py-2">
              {{ song.noteBreakNum }}
            </td>
            <td class="px-3 py-2">
              {{ song.category }}
            </td>
            <td class="px-3 py-2">
              {{ song.version }}
            </td>
            <td class="px-3 py-2">
              {{ song.releaseDate }}
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td
              :colspan="columns.length"
              class="px-3 py-8 text-center text-slate-500"
            >
              没有符合条件的数据
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-3 text-sm dark:border-slate-700">
      <div class="flex items-center gap-2">
        <span>每页</span>
        <select
          :value="pageSize"
          class="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
          @change="onPageSizeChange"
        >
          <option
            v-for="size in pageSizeOptions"
            :key="size"
            :value="size"
          >
            {{ size }}
          </option>
        </select>
        <span>条</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-600"
          :disabled="page <= 1"
          @click="prevPage"
        >
          上一页
        </button>
        <span>第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</span>
        <button
          class="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-600"
          :disabled="page >= totalPages"
          @click="nextPage"
        >
          下一页
        </button>
      </div>
    </div>
  </section>
</template>
