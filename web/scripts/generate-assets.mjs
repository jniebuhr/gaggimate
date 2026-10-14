// Rasterizes assets/src/*.svg into the PNG sources @capacitor/assets expects, then generates all native icon/splash sizes.
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(webDir, 'assets', 'src');
const sizes = { icon: 1024, splash: 2732 };

for (const file of readdirSync(srcDir).filter(f => f.endsWith('.svg'))) {
  const size = sizes[file.split('-')[0]];
  const out = join(webDir, 'assets', file.replace(/\.svg$/, '.png'));
  await sharp(join(srcDir, file), { density: 300 }).resize(size, size).png().toFile(out);
  console.log(`rendered ${out}`);
}

execFileSync(
  'npx',
  [
    'capacitor-assets',
    'generate',
    '--ios',
    '--android',
    '--iconBackgroundColor',
    '#ffffff',
    '--iconBackgroundColorDark',
    '#1d232a',
    '--splashBackgroundColor',
    '#ffffff',
    '--splashBackgroundColorDark',
    '#1d232a',
  ],
  { cwd: webDir, stdio: 'inherit' },
);
