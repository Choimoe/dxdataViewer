import { ref } from 'vue';

const loadedSource = ref('');
const loadedData = ref(null);

export function setLoadedSourceData(source, data) {
  loadedSource.value = source;
  loadedData.value = data;
}

export function clearLoadedSourceData() {
  loadedSource.value = '';
  loadedData.value = null;
}

export function useLoadedDataStore() {
  return {
    loadedSource,
    loadedData,
  };
}
