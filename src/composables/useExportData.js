/**
 * 导出数据为不同格式的 composable
 * 支持：CSV, TXT, XLSX
 */

export default function useExportData() {
  function normalizeExportValue(value) {
    if (value === null || value === undefined) {
      return '';
    }

    if (Array.isArray(value) || typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  }

  /**
   * 获取数据的所有键（从第一条记录）
   */
  function getColumns(data) {
    if (!data || data.length === 0) {
      return [];
    }

    const columns = [];
    const firstRecord = data[0];
    Object.keys(firstRecord).forEach((key) => {
      if (!key.startsWith('_')) { // 忽略内部字段（以_开头）
        columns.push(key);
      }
    });

    return columns;
  }

  /**
   * 转义CSV字段（处理包含逗号、引号、换行的字段）
   */
  function escapeCSVField(field) {
    const str = String(normalizeExportValue(field));

    // 如果包含逗号、引号或换行，需要用引号包围
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * 将对象转换为CSV格式
   */
  function convertToCSV(data) {
    if (!data || data.length === 0) {
      return '';
    }

    const columns = getColumns(data);

    // 创建表头
    const header = columns.map((col) => escapeCSVField(col)).join(',');

    // 创建数据行
    const rows = data.map((record) => columns.map((col) => escapeCSVField(normalizeExportValue(record[col]))).join(','));

    return [header, ...rows].join('\n');
  }

  /**
   * 将对象转换为TXT格式（制表符分隔）
   */
  function convertToTXT(data) {
    if (!data || data.length === 0) {
      return '';
    }

    const columns = getColumns(data);

    // 创建表头
    const header = columns.join('\t');

    // 创建数据行，处理多行值
    const rows = data.map((record) => columns.map((col) => {
      const value = normalizeExportValue(record[col]);
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      // 替换制表符和换行符
      return str.replace(/\t/g, ' ').replace(/\n/g, ' ');
    }).join('\t'));

    return [header, ...rows].join('\n');
  }

  /**
   * 将对象数组导出为XLSX格式（返回base64字符串）
   * 需要外部库支持，这里提供简单实现或提示
   */
  async function convertToXLSX(data) {
    // 尝试动态导入xlsx库
    try {
      // eslint-disable-next-line global-require, import/no-unresolved
      const xlsxModule = await import('xlsx');
      const XLSX = xlsxModule.default || xlsxModule;

      if (!data || data.length === 0) {
        return null;
      }

      const columns = getColumns(data);

      // 转换数据为工作表格式
      const worksheetData = [
        columns, // 表头
        ...data.map((record) => columns.map((col) => normalizeExportValue(record[col]))),
      ];

      // 创建工作簿
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Songs');

      // 设置列宽
      const colWidths = columns.map(() => ({ wch: 15 }));
      worksheet['!cols'] = colWidths;

      return XLSX;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('XLSX library not available. Please install xlsx package.', error);
      return null;
    }
  }

  /**
   * 下载文件
   */
  function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 导出数据为指定格式
   * @param {Array} data 数据数组
   * @param {string} format 格式: 'csv', 'txt', 'xlsx'
   * @param {string} filename 文件名（不含扩展名）
   * @returns {Promise<boolean>} 成功返回true
   */
  async function exportData(data, format, filename) {
    if (!data || data.length === 0) {
      // eslint-disable-next-line no-console
      console.error('No data to export');
      return false;
    }

    try {
      let content;
      let mimeType;
      let extension;

      if (format === 'csv') {
        content = convertToCSV(data);
        mimeType = 'text/csv;charset=utf-8';
        extension = 'csv';
      } else if (format === 'txt') {
        content = convertToTXT(data);
        mimeType = 'text/plain;charset=utf-8';
        extension = 'txt';
      } else if (format === 'xlsx') {
        const XLSX = await convertToXLSX(data);
        if (!XLSX) {
          // eslint-disable-next-line no-console
          console.error('XLSX not available. Install with: pnpm add xlsx');
          return false;
        }

        // 创建工作表和工作簿
        const columns = getColumns(data);
        const worksheetData = [
          columns,
          ...data.map((record) => columns.map((col) => normalizeExportValue(record[col]))),
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Songs');

        // 设置列宽
        const colWidths = columns.map(() => ({ wch: 15 }));
        worksheet['!cols'] = colWidths;

        // 写入文件
        XLSX.writeFile(workbook, `${filename}.xlsx`);
        return true;
      } else {
        // eslint-disable-next-line no-console
        console.error(`Unsupported format: ${format}`);
        return false;
      }

      // 对于CSV和TXT，使用blob下载
      downloadFile(content, `${filename}.${extension}`, mimeType);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Export failed:', error);
      return false;
    }
  }

  return {
    exportData,
  };
}
