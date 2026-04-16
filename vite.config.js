import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import eslint from 'vite-plugin-eslint';
import stylelint from 'vite-plugin-stylelint';
import svgLoader from 'vite-svg-loader';
import autoImport from 'unplugin-auto-import/dist/vite.js';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';

// 递归复制目录的助手函数
function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  const files = readdirSync(src);
  files.forEach((file) => {
    const srcPath = `${src}/${file}`;
    const destPath = `${dest}/${file}`;
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  });
}

// 自定义插件：在构建完成后复制 data 目录
function copyDataPlugin() {
  return {
    name: 'copy-data',
    apply: 'build',
    writeBundle() {
      const srcDir = resolve(__dirname, 'data');
      const destDir = resolve(__dirname, 'dist', 'data');
      try {
        copyDirRecursive(srcDir, destDir);
        // eslint-disable-next-line no-console
        console.log('✓ 已复制 data 目录到 dist');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to copy data directory:', error);
      }
    },
  };
}

export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  return defineConfig({
    base: process.env.VITE_BASE_PUBLIC_PATH || '/dxdataViewer/',
    plugins: [
      eslint({ cache: false }),
      stylelint(),
      svgLoader(),
      vue(),
      copyDataPlugin(),
      autoImport({
        imports: [
          'vue',
          'vue-router',
        ],
        eslintrc: {
          enabled: true,
        },
        dirs: [
          './src/components',
          './src/composables',
        ],
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      fs: {
        allow: ['.', 'data'],
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vue: ['vue', 'vue-router'],
          },
        },
      },
    },
  });
};
