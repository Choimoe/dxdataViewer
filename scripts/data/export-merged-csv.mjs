import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(process.cwd());
const RAW_DIR = resolve(ROOT_DIR, 'data', 'raw', 'merged');
const CSV_DIR = resolve(ROOT_DIR, 'data', 'csv', 'merged');
const MERGED_JSON_PATH = resolve(RAW_DIR, 'merged-data.json');

/**
 * 转义 CSV 值
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

/**
 * 转换为 CSV 字符串
 */
function toCsv(rows, headers) {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const bodyLines = rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

/**
 * 写入 CSV 文件
 */
async function writeCsvFile(fileName, rows, headers) {
  const filePath = resolve(CSV_DIR, fileName);
  const csvText = toCsv(rows, headers);
  await writeFile(filePath, `${csvText}\n`, 'utf8');
  console.log(`✓ ${fileName}: ${rows.length} 行`);
  return filePath;
}

/**
 * 从 merged-data.json 生成 CSV
 */
async function main() {
  try {
    console.log('开始导出 CSV...\n');

    // 创建输出目录
    await mkdir(CSV_DIR, { recursive: true });

    // 读取合并数据
    const jsonText = await readFile(MERGED_JSON_PATH, 'utf8');
    const data = JSON.parse(jsonText);

    if (!data.songs || !Array.isArray(data.songs)) {
      throw new Error('Invalid merged data format');
    }

    // 1. 导出歌曲列表（去重）
    console.log('导出歌曲列表...');
    const songRows = data.songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      bpm: song.bpm,
      category: song.category,
      version: song.version,
      releaseDate: song.releaseDate,
      isNew: song.isNew,
      isLocked: song.isLocked,
      sheetCount: song.sheets ? song.sheets.length : 0,
      dxdata: song.sources?.dxdata,
      divingFish: song.sources?.divingFish,
      maichart: song.sources?.maichart,
    }));

    const songHeaders = [
      'id', 'title', 'artist', 'bpm', 'category', 'version', 'releaseDate',
      'isNew', 'isLocked', 'sheetCount', 'dxdata', 'divingFish', 'maichart',
    ];

    await writeCsvFile('songs.csv', songRows, songHeaders);

    // 2. 导出所有谱面
    console.log('导出谱面列表...');
    const sheetRows = [];

    data.songs.forEach((song) => {
      if (song.sheets && Array.isArray(song.sheets)) {
        song.sheets.forEach((sheet) => {
          const noteCounts = sheet.noteCounts || {};
          sheetRows.push({
            songId: song.id,
            songTitle: song.title,
            artist: song.artist,
            category: song.category,
            version: song.version,
            sheetType: sheet.type || '',
            difficulty: sheet.difficulty || '',
            level: sheet.level || '',
            internalLevelValue: sheet.internalLevelValue || '',
            noteDesigner: sheet.noteDesigner || '',
            noteTap: noteCounts.tap || '',
            noteHold: noteCounts.hold || '',
            noteSlide: noteCounts.slide || '',
            noteTouch: noteCounts.touch || '',
            noteBreak: noteCounts.break || '',
            noteTotal: noteCounts.total || '',
            isSpecial: sheet.isSpecial,
            dxdata: song.sources?.dxdata,
            divingFish: song.sources?.divingFish,
          });
        });
      }
    });

    const sheetHeaders = [
      'songId', 'songTitle', 'artist', 'category', 'version',
      'sheetType', 'difficulty', 'level', 'internalLevelValue', 'noteDesigner',
      'noteTap', 'noteHold', 'noteSlide', 'noteTouch', 'noteBreak', 'noteTotal',
      'isSpecial', 'dxdata', 'divingFish',
    ];

    await writeCsvFile('sheets.csv', sheetRows, sheetHeaders);

    // 3. 导出数据覆盖统计
    console.log('导出数据覆盖统计...');
    const statsRows = [];

    // 按歌曲统计
    let totalSongs = 0;
    let dxdataMatches = 0;
    let divingFishMatches = 0;
    let allSourcesMatches = 0;

    // 按谱面统计
    let totalSheets = 0;
    let sheetsWithDesigner = 0;

    data.songs.forEach((song) => {
      totalSongs += 1;
      if (song.sources?.dxdata) dxdataMatches += 1;
      if (song.sources?.divingFish) divingFishMatches += 1;
      if (song.sources?.dxdata && song.sources?.divingFish && song.sources?.maichart) {
        allSourcesMatches += 1;
      }

      if (song.sheets && Array.isArray(song.sheets)) {
        song.sheets.forEach((sheet) => {
          totalSheets += 1;
          if (sheet.noteDesigner && sheet.noteDesigner !== '-' && sheet.noteDesigner !== '') {
            sheetsWithDesigner += 1;
          }
        });
      }
    });

    statsRows.push({
      metric: '总歌曲数',
      value: totalSongs,
      percentage: '',
    });
    statsRows.push({
      metric: 'dxdata 匹配',
      value: dxdataMatches,
      percentage: ((dxdataMatches / totalSongs) * 100).toFixed(1) + '%',
    });
    statsRows.push({
      metric: 'diving-fish 匹配',
      value: divingFishMatches,
      percentage: ((divingFishMatches / totalSongs) * 100).toFixed(1) + '%',
    });
    statsRows.push({
      metric: '三源都有',
      value: allSourcesMatches,
      percentage: ((allSourcesMatches / totalSongs) * 100).toFixed(1) + '%',
    });
    statsRows.push({
      metric: '总谱面数',
      value: totalSheets,
      percentage: '',
    });
    statsRows.push({
      metric: '有谱师信息',
      value: sheetsWithDesigner,
      percentage: ((sheetsWithDesigner / totalSheets) * 100).toFixed(1) + '%',
    });
    statsRows.push({
      metric: '缺谱师信息',
      value: totalSheets - sheetsWithDesigner,
      percentage: (((totalSheets - sheetsWithDesigner) / totalSheets) * 100).toFixed(1) + '%',
    });

    const statsHeaders = ['metric', 'value', 'percentage'];
    await writeCsvFile('statistics.csv', statsRows, statsHeaders);

    // 4. 导出缺失谱师的谱面
    console.log('导出缺失谱师的谱面...');
    const missingDesignerRows = sheetRows.filter((row) => row.noteDesigner === '' || row.noteDesigner === '-');

    await writeCsvFile('missing-designers.csv', missingDesignerRows, sheetHeaders);

    // 5. 导出数据源对比（三源数据不一致的记录）
    console.log('导出数据源覆盖详情...');
    const sourceComparisonRows = [];

    data.songs.forEach((song) => {
      const hasDxdata = song.sources?.dxdata ? '✓' : '✗';
      const hasDivingFish = song.sources?.divingFish ? '✓' : '✗';
      const hasMaichart = song.sources?.maichart ? '✓' : '✗';

      sourceComparisonRows.push({
        songId: song.id,
        songTitle: song.title,
        dxdata: hasDxdata,
        divingFish: hasDivingFish,
        maichart: hasMaichart,
        sheetCount: song.sheets ? song.sheets.length : 0,
      });
    });

    const sourceComparisonHeaders = ['songId', 'songTitle', 'dxdata', 'divingFish', 'maichart', 'sheetCount'];
    await writeCsvFile('source-coverage.csv', sourceComparisonRows, sourceComparisonHeaders);

    // 6. 导出合并失败记录（仅当 dxdata 和 diving-fish 都缺失）
    console.log('导出合并失败记录...');
    const mergeFailureRows = data.songs
      .filter((song) => !song.sources?.dxdata && !song.sources?.divingFish)
      .map((song) => {
        const missingSources = [];
        if (!song.sources?.dxdata) missingSources.push('dxdata');
        if (!song.sources?.divingFish) missingSources.push('diving-fish');

        return {
          songId: song.id,
          songTitle: song.title,
          titleDxdata: song.titleDxdata || '',
          titleDivingFish: song.titleDivingFish || '',
          missingSources: missingSources.join('|'),
          hasDxdata: song.sources?.dxdata ? 'Y' : 'N',
          hasDivingFish: song.sources?.divingFish ? 'Y' : 'N',
          hasMaichart: song.sources?.maichart ? 'Y' : 'N',
          sheetCount: song.sheets ? song.sheets.length : 0,
        };
      });

    const mergeFailureHeaders = [
      'songId',
      'songTitle',
      'titleDxdata',
      'titleDivingFish',
      'missingSources',
      'hasDxdata',
      'hasDivingFish',
      'hasMaichart',
      'sheetCount',
    ];
    await writeCsvFile('merge-failures.csv', mergeFailureRows, mergeFailureHeaders);

    console.log('\n✓ 所有 CSV 导出完成！');
    console.log(`\n导出文件位置：${CSV_DIR}`);
    console.log('\n生成的文件：');
    console.log('  1. songs.csv - 所有歌曲（去重）');
    console.log('  2. sheets.csv - 所有谱面');
    console.log('  3. statistics.csv - 数据覆盖统计');
    console.log('  4. missing-designers.csv - 缺失谱师的谱面');
    console.log('  5. source-coverage.csv - 数据源覆盖详情');
    console.log('  6. merge-failures.csv - 合并失败记录（双源都缺失）');
  } catch (error) {
    console.error('导出失败:', error.message);
    process.exit(1);
  }
}

main();
