import { readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(root, 'public/personalized-home-2-0/asset/wallpapers/official');
const distDir = resolve(root, 'dist/personalized-home-2-0/asset/wallpapers/official');
const videos = readdirSync(sourceDir).filter(file => file.endsWith('.mp4'));

if (videos.length === 0) throw new Error('No official wallpaper videos found');
for (const file of videos) rmSync(resolve(distDir, file));
// These previews are already shipped as Tauri resources and resolved through
// asset://. Dock icons are compiled into Rust, so neither needs a second copy
// inside the embedded frontend archive.
rmSync(resolve(distDir, 'previews'), { recursive: true, force: true });
rmSync(resolve(root, 'dist/personalized-home-2-0/asset/images/app-icons-dock'), { recursive: true, force: true });

console.log(`Prepared ${videos.length} official wallpaper videos as streaming bundle resources.`);
