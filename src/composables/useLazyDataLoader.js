import { ref } from 'vue';

/**
 * 动态加载数据的 composable
 * 支持显示进度条和加载状态管理
 */
export default function useLazyDataLoader() {
  const loadingProgress = ref(0);
  const isLoading = ref(false);
  const error = ref(null);
  const data = ref(null);
  const currentSource = ref(null);

  const dataSourceInfo = {
    dxdata: {
      name: 'DXData',
      description: '从 DXData 官方数据源',
      url: 'data/raw/dxdata/dxdata.json',
      size: '约 20MB',
    },
    diving_fish: {
      name: 'Diving Fish',
      description: '从 Diving Fish 数据源',
      url: 'data/raw/diving-fish/music_data.json',
      size: '约 8MB',
    },
    merged: {
      name: '混合数据源（推荐）',
      description: '统合所有数据源，包含最完整的谱师信息',
      url: 'data/raw/merged/merged-data.json',
      size: '约 6.5MB',
    },
  };

  /**
   * 模拟进度条更新
   */
  const simulateProgress = (total = 100, duration = 3000) => {
    const interval = 30;
    const steps = duration / interval;
    const increment = total / steps;
    let current = 0;

    const timer = setInterval(() => {
      current = Math.min(current + increment, total - 5);
      loadingProgress.value = Math.floor(current);
    }, interval);

    return () => clearInterval(timer);
  };

  /**
   * 加载数据
   *
   * @param {string} source - 数据源标识 (dxdata|diving_fish|merged)
   */
  const loadData = async (source) => {
    if (!dataSourceInfo[source]) {
      error.value = `未知的数据源: ${source}`;
      return;
    }

    isLoading.value = true;
    error.value = null;
    loadingProgress.value = 0;
    currentSource.value = source;

    // 开始模拟进度
    const closeProgress = simulateProgress();

    try {
      const response = await fetch(dataSourceInfo[source].url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 获取总字节数
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let received = 0;

      // 读取响应体流并更新进度
      const reader = response.body.getReader();
      const chunks = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        received += value.length;

        if (total > 0) {
          loadingProgress.value = Math.floor((received / total) * 90) + 5;
        }
      }

      // 拼接数据
      const buffer = new Uint8Array(received);
      let offset = 0;

      // eslint-disable-next-line no-restricted-syntax
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(buffer);
      data.value = JSON.parse(text);
      loadingProgress.value = 100;
    } catch (err) {
      error.value = `加载失败: ${err.message}`;
      loadingProgress.value = 0;
      data.value = null;
    } finally {
      closeProgress();
      isLoading.value = false;
    }
  };

  /**
   * 清除数据
   */
  const clearData = () => {
    data.value = null;
    currentSource.value = null;
    loadingProgress.value = 0;
    error.value = null;
  };

  return {
    loadingProgress,
    isLoading,
    error,
    data,
    currentSource,
    dataSourceInfo,
    loadData,
    clearData,
  };
}
