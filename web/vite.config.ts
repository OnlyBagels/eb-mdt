import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Plugin to copy images and static files to dist/web after build
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    closeBundle() {
      // Copy images
      const srcDir = path.resolve('./images');
      const destDir = path.resolve('../dist/web/images');
      try {
        mkdirSync(destDir, { recursive: true });
        const files = readdirSync(srcDir);
        for (const file of files) {
          if (file.endsWith('.webp') || file.endsWith('.png') || file.endsWith('.jpg')) {
            copyFileSync(path.join(srcDir, file), path.join(destDir, file));
          }
        }
        console.log(`Copied ${files.length} images to dist/web/images/`);
      } catch (e) {
        console.warn('Could not copy images:', e);
      }

      // Copy postals.json
      try {
        const postalsPath = path.resolve('../static/postals.json');
        const postalsDestPath = path.resolve('../dist/web/postals.json');
        copyFileSync(postalsPath, postalsDestPath);
        console.log('Copied postals.json to dist/web/');
      } catch (e) {
        console.warn('Could not copy postals.json:', e);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [svelte(), copyAssetsPlugin()],
    base: './',
    resolve: {
      alias: {
        $lib: path.resolve('./src/lib'),
        '~': path.resolve('../'),
        '@common': path.resolve('../src/common/'),
      },
    },
    ...(mode === 'development' && { publicDir: '../' }),
    build: {
      outDir: '../dist/web',
      emptyOutDir: true,
      target: 'es2023',
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name][extname]',
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
        },
      },
    },
  };
});
