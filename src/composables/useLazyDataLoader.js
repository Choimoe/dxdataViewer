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
   * 在未知总大小时平滑推进，避免进度条停滞。
   */
  const createProgressPacer = (start = 0, ceiling = 85, step = 0.6, interval = 80) => {
    let current = start;

    const timer = setInterval(() => {
      current = Math.min(current + step, ceiling);
      loadingProgress.value = Math.max(loadingProgress.value, Math.floor(current));
    }, interval);

    return {
      stop() {
        clearInterval(timer);
      },
      setCeiling(nextCeiling) {
        current = Math.min(current, nextCeiling);
      },
    };
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

    const pacer = createProgressPacer(0, 85);

    try {
      const response = await fetch(dataSourceInfo[source].url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 获取总字节数。
      // 压缩响应时 content-length 通常是压缩后体积，和 reader 读取到的解压字节不一致，
      // 这会导致百分比超过 100%。因此仅在非压缩场景下将其视为可信总量。
      const contentLength = response.headers.get('content-length');
      const contentEncoding = (response.headers.get('content-encoding') || '').toLowerCase();
      const parsedTotal = contentLength ? parseInt(contentLength, 10) : 0;
      const total = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 0;
      const hasCompressedBody = contentEncoding && contentEncoding !== 'identity';
      const canTrustTotal = total > 0 && !hasCompressedBody;
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

        if (canTrustTotal) {
          const ratio = Math.min(received / total, 1);
          const networkProgress = 5 + Math.floor(ratio * 83);
          loadingProgress.value = Math.max(loadingProgress.value, networkProgress);
        } else {
          // 未知或不可信总量时，按读取节奏缓慢推进，避免抖动。
          pacer.setCeiling(88);
        }
      }

      pacer.stop();
      loadingProgress.value = Math.max(loadingProgress.value, 92);

      // 拼接数据
      const buffer = new Uint8Array(received);
      let offset = 0;

      // eslint-disable-next-line no-restricted-syntax
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(buffer);
      loadingProgress.value = Math.max(loadingProgress.value, 96);
      data.value = JSON.parse(text);
      loadingProgress.value = 100;
    } catch (err) {
      error.value = `加载失败: ${err.message}`;
      loadingProgress.value = 0;
      data.value = null;
    } finally {
      pacer.stop();
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
