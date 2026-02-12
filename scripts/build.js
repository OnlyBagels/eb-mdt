//@ts-check

import { exists, exec, getFiles } from './utils.js';
import { createBuilder, createFxmanifest } from '@communityox/fx-utils';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const watch = process.argv.includes('--watch');
const web = await exists('./web');
const dropLabels = ['$BROWSER'];

if (!watch) dropLabels.push('$DEV');

// Auto-increment patch version on build (not watch mode)
if (!watch) {
  try {
    const packagePath = './package.json';
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    const [major, minor, patch] = pkg.version.split('.').map(Number);
    pkg.version = `${major}.${minor}.${patch + 1}`;
    writeFileSync(packagePath, JSON.stringify(pkg, null, '\t') + '\n');
    console.log(`\x1b[32m[MDT] Version bumped to ${pkg.version}\x1b[0m`);
  } catch (e) {
    console.error('[MDT] Failed to bump version:', e);
  }
}

createBuilder(
  watch,
  {
    keepNames: true,
    legalComments: 'inline',
    bundle: true,
    treeShaking: true,
  },
  [
    {
      name: 'server',
      options: {
        platform: 'node',
        target: ['node22'],
        format: 'cjs',
        dropLabels: [...dropLabels, '$CLIENT'],
      },
    },
    {
      name: 'client',
      options: {
        platform: 'browser',
        target: ['es2021'],
        format: 'iife',
        dropLabels: [...dropLabels, '$SERVER'],
      },
    },
  ],
  async (outfiles) => {
    const files = await getFiles('dist/web', 'static', 'locales');
    await createFxmanifest({
      client_scripts: [outfiles.client],
      server_scripts: [outfiles.server],
      files: ['locales/*.json', 'dist/web/index.html', 'dist/web/assets/**', 'dist/web/images/**', 'sounds/*.wav', 'audiodirectory/*.awc', 'audiodata/*.rel', ...files],
      dependencies: ['/server:13068', '/onesync', 'qbx_core', 'ox_lib', 'oxmysql'],
      metadata: {
        ui_page: 'dist/web/index.html',
        node_version: '22'
      },
    });

    // Append native audio data_file entries (not supported by createFxmanifest)
    appendFileSync('fxmanifest.lua', "\ndata_file 'AUDIO_WAVEPACK' 'audiodirectory'\ndata_file 'AUDIO_SOUNDDATA' 'audiodata/mdt_sounds.dat'\n");

    if (web && !watch) await exec("cd ./web && vite build");
  }
);

if (web && watch) await exec("cd ./web && vite build --watch");
