import React from 'react';

/**
 * Natural Banner Ambient Service
 * 
 * Samples banner colors (bottom area, left/right tones, dominant)
 * to render a natural, harmonious ambient color wash matching the artwork's
 * own palette, using the borderless curved radial layout with high text legibility.
 */

export interface BannerAmbientColors {
  bottomRgb: [number, number, number];
  leftRgb: [number, number, number];
  rightRgb: [number, number, number];
  dominantRgb: [number, number, number];
  titleBackgroundStyle: React.CSSProperties;
  titleTopGlowBorder: string;
}

// Convert RGB (0..255) to HSL (h: 0..360, s: 0..100, l: 0..100)
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

// Convert HSL (h: 0..360, s: 0..100, l: 0..100) to RGB (0..255)
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

const DEFAULT_BOTTOM: [number, number, number] = [18, 24, 38];
const DEFAULT_LEFT: [number, number, number] = [20, 28, 46];
const DEFAULT_RIGHT: [number, number, number] = [20, 28, 46];
const DEFAULT_DOMINANT: [number, number, number] = [26, 36, 60];

export const DEFAULT_AMBIENT: BannerAmbientColors = {
  bottomRgb: DEFAULT_BOTTOM,
  leftRgb: DEFAULT_LEFT,
  rightRgb: DEFAULT_RIGHT,
  dominantRgb: DEFAULT_DOMINANT,
  titleBackgroundStyle: {
    background: [
      'radial-gradient(ellipse 135% 82% at 50% 100%, rgba(12, 16, 28, 0.95) 0%, rgba(12, 16, 28, 0.85) 45%, rgba(32, 48, 80, 0.35) 75%, transparent 100%)',
      'radial-gradient(ellipse 75% 65% at 0% 100%, rgba(20, 32, 54, 0.65) 0%, transparent 70%)',
      'radial-gradient(ellipse 75% 65% at 100% 100%, rgba(20, 32, 54, 0.65) 0%, transparent 70%)',
    ].join(', '),
  },
  titleTopGlowBorder: '',
};

const ambientCache = new Map<string, BannerAmbientColors>();

function buildNaturalBannerAmbient(
  bottom: [number, number, number],
  left: [number, number, number],
  right: [number, number, number],
  dominant: [number, number, number]
): BannerAmbientColors {
  // Use the banner's own normal sampled colors
  const [botH, botS] = rgbToHsl(...bottom);
  const [domH, domS] = rgbToHsl(...dominant);

  // Preferred hue: bottom area's hue, or dominant if bottom has near-zero saturation
  const primaryHue = botS > 15 ? botH : domH;
  const primarySat = Math.max(botS, domS, 35);

  // Deep chromatic base: banner's own normal color at L ~ 11% for high contrast against white text
  const deepBase = hslToRgb(primaryHue, Math.min(80, primarySat + 15), 11);

  // Vibrant mid-tone radiance: banner's own normal color at L ~ 42%
  const vibrantMid = hslToRgb(primaryHue, Math.min(85, primarySat + 20), 42);

  // Left & right corner tones sampled directly from the artwork
  const [leftH, leftS] = rgbToHsl(...left);
  const [rightH, rightS] = rgbToHsl(...right);
  const leftTone = hslToRgb(leftS > 15 ? leftH : primaryHue, Math.max(leftS, 45), 38);
  const rightTone = hslToRgb(rightS > 15 ? rightH : primaryHue, Math.max(rightS, 45), 38);

  const [dbr, dbg, dbb] = deepBase;
  const [vmr, vmg, vmb] = vibrantMid;
  const [lr, lg, lb] = leftTone;
  const [rr, rg, rb] = rightTone;

  // Natural Harmonious Color Stage:
  // - High opacity base (0.95 -> 0.85) ensures text is always crystal-clear and never washed out.
  // - Uses the banner's own normal colors to blend organically with the artwork.
  // - Strictly curved radial & elliptical sweeps with zero straight cutoffs or blur filters.
  const titleBackgroundStyle: React.CSSProperties = {
    background: [
      `radial-gradient(ellipse 135% 82% at 50% 100%, rgba(${dbr}, ${dbg}, ${dbb}, 0.95) 0%, rgba(${dbr}, ${dbg}, ${dbb}, 0.85) 45%, rgba(${vmr}, ${vmg}, ${vmb}, 0.35) 75%, transparent 100%)`,
      `radial-gradient(ellipse 75% 65% at 0% 100%, rgba(${lr}, ${lg}, ${lb}, 0.65) 0%, transparent 70%)`,
      `radial-gradient(ellipse 75% 65% at 100% 100%, rgba(${rr}, ${rg}, ${rb}, 0.65) 0%, transparent 70%)`,
    ].join(', '),
  };

  return {
    bottomRgb: bottom,
    leftRgb: left,
    rightRgb: right,
    dominantRgb: dominant,
    titleBackgroundStyle,
    titleTopGlowBorder: '',
  };
}

/**
 * Extracts normal natural colors from the banner image using an offscreen canvas.
 * Focuses on sampling the bottom area (where the title is written)
 * along with left, right, and dominant tones.
 */
export async function extractBannerAmbient(imageUrl: string): Promise<BannerAmbientColors> {
  if (!imageUrl || !imageUrl.trim()) return DEFAULT_AMBIENT;

  const key = imageUrl.trim();
  if (ambientCache.has(key)) {
    return ambientCache.get(key)!;
  }

  if (typeof window === 'undefined') return DEFAULT_AMBIENT;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 20;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          ambientCache.set(key, DEFAULT_AMBIENT);
          return resolve(DEFAULT_AMBIENT);
        }

        ctx.drawImage(img, 0, 0, 32, 20);
        const imgData = ctx.getImageData(0, 0, 32, 20).data;

        // Sample bottom area where title sits (y = 12..19, x = 0..31)
        let botR = 0, botG = 0, botB = 0, botCount = 0;
        for (let y = 12; y < 20; y++) {
          for (let x = 0; x < 32; x++) {
            const idx = (y * 32 + x) * 4;
            botR += imgData[idx];
            botG += imgData[idx + 1];
            botB += imgData[idx + 2];
            botCount++;
          }
        }

        // Sample bottom-left area (y = 12..19, x = 0..10)
        let leftR = 0, leftG = 0, leftB = 0, leftCount = 0;
        for (let y = 12; y < 20; y++) {
          for (let x = 0; x < 10; x++) {
            const idx = (y * 32 + x) * 4;
            leftR += imgData[idx];
            leftG += imgData[idx + 1];
            leftB += imgData[idx + 2];
            leftCount++;
          }
        }

        // Sample bottom-right area (y = 12..19, x = 21..31)
        let rightR = 0, rightG = 0, rightB = 0, rightCount = 0;
        for (let y = 12; y < 20; y++) {
          for (let x = 21; x < 32; x++) {
            const idx = (y * 32 + x) * 4;
            rightR += imgData[idx];
            rightG += imgData[idx + 1];
            rightB += imgData[idx + 2];
            rightCount++;
          }
        }

        // Sample center / overall dominant
        let domR = 0, domG = 0, domB = 0, domCount = 0;
        for (let y = 4; y < 16; y++) {
          for (let x = 6; x < 26; x++) {
            const idx = (y * 32 + x) * 4;
            domR += imgData[idx];
            domG += imgData[idx + 1];
            domB += imgData[idx + 2];
            domCount++;
          }
        }

        const bottomRgb: [number, number, number] = [
          Math.round(botR / (botCount || 1)),
          Math.round(botG / (botCount || 1)),
          Math.round(botB / (botCount || 1)),
        ];

        const leftRgb: [number, number, number] = [
          Math.round(leftR / (leftCount || 1)),
          Math.round(leftG / (leftCount || 1)),
          Math.round(leftB / (leftCount || 1)),
        ];

        const rightRgb: [number, number, number] = [
          Math.round(rightR / (rightCount || 1)),
          Math.round(rightG / (rightCount || 1)),
          Math.round(rightB / (rightCount || 1)),
        ];

        const domRgb: [number, number, number] = [
          Math.round(domR / (domCount || 1)),
          Math.round(domG / (domCount || 1)),
          Math.round(domB / (domCount || 1)),
        ];

        const result = buildNaturalBannerAmbient(bottomRgb, leftRgb, rightRgb, domRgb);
        ambientCache.set(key, result);
        resolve(result);
      } catch {
        ambientCache.set(key, DEFAULT_AMBIENT);
        resolve(DEFAULT_AMBIENT);
      }
    };

    img.onerror = () => {
      ambientCache.set(key, DEFAULT_AMBIENT);
      resolve(DEFAULT_AMBIENT);
    };

    img.src = key;
  });
}
