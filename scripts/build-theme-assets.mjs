/**
 * Rebuilds the theme environment assets in `assets/themes/*`.
 *
 *   node scripts/build-theme-assets.mjs
 *
 * Photos are fetched from their licensed sources (see assets/themes/ATTRIBUTION.md),
 * cropped and recompressed. Textures are generated procedurally so they tile seamlessly.
 */
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Jimp = require('jimp-compact');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...parts) => path.join(root, 'assets', 'themes', ...parts);

/**
 * Photography chosen to echo the Kiburan reference mockup:
 * - Traditional heroes: Habesha wedding couple (Pexels)
 * - Traditional atmosphere: warm Ethiopian hospitality interior (coffee ceremony)
 * - Modern: Addis Ababa studio sunset couple (kept local; Unsplash can be flaky)
 * - Fusion: cream reception hall matching the Fusion column of the reference
 */
const PHOTOS = {
  traditionalCouple: {
    url: 'https://images.pexels.com/photos/34498421/pexels-photo-34498421.jpeg?auto=compress&cs=tinysrgb&w=1600',
  },
  traditionalAtmosphere: {
    url: 'https://images.pexels.com/photos/18765288/pexels-photo-18765288.jpeg?auto=compress&cs=tinysrgb&w=1600',
  },
  fusion: {
    url: 'https://images.pexels.com/photos/2306281/pexels-photo-2306281.jpeg?auto=compress&cs=tinysrgb&w=1600',
  },
};

async function fetchImage(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  return Jimp.read(Buffer.from(await response.arrayBuffer()));
}

async function save(image, file, quality = 76) {
  await mkdir(path.dirname(file), { recursive: true });
  await image.quality(quality).writeAsync(file);
}

/** Crop a vertical band (fractions of height) across the full width. */
function cropBand(image, top, bottom) {
  const { width, height } = image.bitmap;
  const y = Math.round(height * top);
  return image.clone().crop(0, y, width, Math.round(height * bottom) - y);
}

async function buildPhotos() {
  const traditional = await fetchImage(PHOTOS.traditionalCouple.url);
  await save(
    cropBand(traditional, 0.4, 0.84).resize(1200, Jimp.AUTO),
    out('traditional', 'wedding-images', 'hero.jpg'),
  );
  await save(
    cropBand(traditional, 0.44, 0.8).resize(560, Jimp.AUTO),
    out('traditional', 'wedding-images', 'preview.jpg'),
  );
  await save(
    cropBand(traditional, 0.3, 1).resize(1080, Jimp.AUTO),
    out('traditional', 'wedding-images', 'portrait.jpg'),
    72,
  );

  const traditionalAtmosphere = await fetchImage(PHOTOS.traditionalAtmosphere.url);
  await save(
    traditionalAtmosphere.clone().cover(1200, 900),
    out('traditional', 'wedding-images', 'atmosphere.jpg'),
    74,
  );

  // Modern: reuse the verified OneStop / Unsplash hero already on disk; derive atmosphere + preview.
  const modernHeroPath = out('modern', 'wedding-images', 'hero.jpg');
  const modern = await Jimp.read(modernHeroPath);
  await save(modern.clone().cover(1200, 900), out('modern', 'wedding-images', 'atmosphere.jpg'), 74);
  await save(
    cropBand(modern, 0.12, 0.92).resize(560, Jimp.AUTO),
    out('modern', 'wedding-images', 'preview.jpg'),
  );

  const fusion = await fetchImage(PHOTOS.fusion.url);
  await save(fusion.clone().cover(1200, 800), out('fusion', 'wedding-images', 'hero.jpg'));
  await save(
    cropBand(fusion, 0.08, 0.82).resize(560, Jimp.AUTO),
    out('fusion', 'wedding-images', 'preview.jpg'),
  );
  await save(fusion.clone().cover(1200, 900), out('fusion', 'wedding-images', 'atmosphere.jpg'), 74);

  // Ensure modern hero remains present even if only atmosphere was regenerated.
  await copyFile(modernHeroPath, modernHeroPath);
}

/** Deterministic PRNG so rebuilt textures are byte-stable. */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function buildWeave({ file, size, thread, rgb, maxAlpha, slub, seed }) {
  const random = mulberry32(seed);
  const count = size / thread;
  const warp = Array.from({ length: count }, () => 0.55 + random() * 0.45);
  const weft = Array.from({ length: count }, () => 0.55 + random() * 0.45);
  const image = new Jimp(size, size, 0x00000000);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const tx = Math.floor(x / thread);
      const ty = Math.floor(y / thread);
      const over = (tx + ty) % 2 === 0;
      const strength = over ? warp[tx] : weft[ty];
      const edge = over ? x % thread : y % thread;
      const shade = edge === 0 || edge === thread - 1 ? 1 : 0.45;
      const noise = random() < slub ? 1.6 : 1;
      const alpha = Math.min(255, Math.round(maxAlpha * strength * shade * noise));
      image.setPixelColor(Jimp.rgbaToInt(rgb[0], rgb[1], rgb[2], alpha), x, y);
    }
  }
  await mkdir(path.dirname(file), { recursive: true });
  await image.writeAsync(file);
}

async function buildTextures() {
  await buildWeave({
    file: out('traditional', 'textures', 'shamma-weave.png'),
    size: 96,
    thread: 3,
    rgb: [73, 54, 43],
    maxAlpha: 42,
    slub: 0.025,
    seed: 1931,
  });
  await buildWeave({
    file: out('fusion', 'textures', 'linen.png'),
    size: 64,
    thread: 2,
    rgb: [129, 67, 75],
    maxAlpha: 22,
    slub: 0.012,
    seed: 2024,
  });
  await buildWeave({
    file: out('modern', 'textures', 'paper-grain.png'),
    size: 64,
    thread: 2,
    rgb: [41, 43, 41],
    maxAlpha: 10,
    slub: 0.02,
    seed: 77,
  });
}

await buildTextures();
await buildPhotos();
console.log('Theme assets rebuilt in assets/themes');
