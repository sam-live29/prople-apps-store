/**
 * Utilities for App Media Upload, Validation & Formatting
 */

export interface ImageDimensionResult {
  width: number;
  height: number;
  aspectRatio: number;
  aspectRatioString: string;
  isValidIcon: boolean;
  isValidFeatureGraphic: boolean;
  isValidScreenshot: boolean;
  fileSizeFormatted: string;
  sizeBytes: number;
}

/**
 * Format bytes to readable size string (e.g. 1.2 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Strict binary and magic byte validation for uploaded image files.
 * Prevents image poisoning, disguised documents (PDF, DOCX, ZIP), and executables.
 */
export async function validateImageBinary(file: File): Promise<{ valid: boolean; error?: string }> {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // 1. Strict MIME type check
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif'];
  const fileType = file.type ? file.type.toLowerCase().trim() : '';

  if (fileType && !allowedMimeTypes.includes(fileType)) {
    return {
      valid: false,
      error: `Invalid file type. Only authentic image files (PNG, JPG, WebP, AVIF) are permitted. Documents, archives, and executables are not allowed.`
    };
  }

  // 2. Magic byte / header verification
  try {
    const slice = file.slice(0, 32);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length < 4) {
      return { valid: false, error: 'File is empty or corrupted.' };
    }

    // PDF check: %PDF-
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { valid: false, error: 'Disguised PDF document detected. Please upload an authentic image file.' };
    }

    // ZIP / APK / Office DOCX: PK\x03\x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && (bytes[2] === 0x03 || bytes[2] === 0x05)) {
      return { valid: false, error: 'Disguised document package or archive detected. Please upload an authentic image file.' };
    }

    // Windows PE executable: MZ
    if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
      return { valid: false, error: 'Disguised executable binary detected. Please upload an authentic image file.' };
    }

    // Linux ELF binary: \x7FELF
    if (bytes[0] === 0x7F && bytes[1] === 0x45 && bytes[2] === 0x4C && bytes[3] === 0x46) {
      return { valid: false, error: 'Disguised executable binary detected. Please upload an authentic image file.' };
    }

    // Recognized image headers:
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
    const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46; // WebP
    const isAvif = bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70; // ftyp

    if (!isPng && !isJpeg && !isGif && !isRiff && !isAvif) {
      return { valid: false, error: 'Unrecognized image file format. Please upload an authentic PNG, JPG, WebP, or AVIF.' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Failed to inspect image header: ${err.message || 'unknown error'}` };
  }
}

/**
 * Read image dimensions and metadata from a File or Data URL
 */
export function inspectImage(source: File | string): Promise<ImageDimensionResult> {
  return new Promise(async (resolve, reject) => {
    let url: string;
    let sizeBytes = 0;

    if (source instanceof File) {
      // Validate magic bytes against disguised documents and poison files
      const validation = await validateImageBinary(source);
      if (!validation.valid) {
        reject(new Error(validation.error || 'Invalid image file.'));
        return;
      }
      url = URL.createObjectURL(source);
      sizeBytes = source.size;
    } else {
      url = source;
      // Estimate size if base64
      if (source.startsWith('data:')) {
        const base64Str = source.split(',')[1] || '';
        sizeBytes = Math.round((base64Str.length * 3) / 4);
      } else {
        sizeBytes = 250 * 1024; // estimate for external url
      }
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const aspectRatio = width / (height || 1);

      // Icon: 512x512 recommended, 1:1 ratio
      const isValidIcon = Math.abs(aspectRatio - 1) < 0.05 && width >= 192;
      
      // Feature graphic: Exact 16:9 aspect ratio (e.g. 1920x1080, 1280x720, 1024x576)
      const is16By9 = Math.abs(aspectRatio - (16 / 9)) < 0.035;
      const isValidFeatureGraphic = is16By9 && width >= 640;

      // Screenshot: between 320px and 3840px, 16:9 or 9:16 or common mobile aspect ratios (18:9, 19.5:9, 4:3, 16:10)
      const isValidScreenshot = width >= 320 && height >= 320 && width <= 3840 && height <= 3840;

      // Aspect ratio string approximation
      let aspectRatioString = `${width}:${height}`;
      if (Math.abs(aspectRatio - 1) < 0.05) aspectRatioString = '1:1 (Square)';
      else if (Math.abs(aspectRatio - 9/16) < 0.05) aspectRatioString = '9:16 (Portrait)';
      else if (Math.abs(aspectRatio - 16/9) < 0.035) aspectRatioString = '16:9 (Widescreen Banner)';
      else if (Math.abs(aspectRatio - 1024/500) < 0.05) aspectRatioString = '1024:500 (Legacy Banner)';
      else if (Math.abs(aspectRatio - 9/19.5) < 0.08) aspectRatioString = '9:19.5 (Tall Mobile)';

      if (source instanceof File) {
        URL.revokeObjectURL(url);
      }

      resolve({
        width,
        height,
        aspectRatio,
        aspectRatioString,
        isValidIcon,
        isValidFeatureGraphic,
        isValidScreenshot,
        fileSizeFormatted: formatBytes(sizeBytes),
        sizeBytes
      });
    };

    img.onerror = () => {
      if (source instanceof File) {
        URL.revokeObjectURL(url);
      }
      reject(new Error('Failed to load or inspect image. Ensure valid format (PNG, JPG, WebP).'));
    };

    img.src = url;
  });
}

/**
 * Extract YouTube Video ID from standard YouTube URLs (watch, embed, youtu.be, shorts)
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
  const match = url.match(regExp);
  return (match && match[1]?.length === 11) ? match[1] : null;
}

/**
 * Check if a URL is a YouTube video link
 */
export function isYouTubeUrl(url: string): boolean {
  return Boolean(extractYouTubeId(url));
}

/**
 * Get YouTube video thumbnail URL
 */
export function getYouTubeThumbnail(urlOrId: string, quality: 'maxres' | 'hq' = 'hq'): string {
  if (!urlOrId || typeof urlOrId !== 'string') return '';
  const extracted = extractYouTubeId(urlOrId);
  const id = extracted || (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId.trim()) ? urlOrId.trim() : '');
  if (!id) return '';
  return quality === 'maxres' 
    ? `https://img.youtube.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`
    : `https://img.youtube.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

export interface YouTubeThumbnailOption {
  id: string;
  label: string;
  sublabel: string;
  url: string;
  badge?: string;
}

/**
 * Get all available YouTube thumbnail variants for a given video
 */
export function getAllYouTubeThumbnails(urlOrId: string): YouTubeThumbnailOption[] {
  const id = extractYouTubeId(urlOrId) || urlOrId;
  if (!id) return [];

  return [
    {
      id: 'maxres',
      label: 'HD Max Resolution',
      sublabel: '1280 × 720 (16:9)',
      url: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      badge: 'HD 720p',
    },
    {
      id: 'hq',
      label: 'High Quality',
      sublabel: '480 × 360',
      url: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      badge: 'HQ',
    },
    {
      id: 'sd',
      label: 'Standard Definition',
      sublabel: '640 × 480',
      url: `https://img.youtube.com/vi/${id}/sddefault.jpg`,
      badge: 'SD',
    },
    {
      id: 'mq',
      label: 'Medium Quality',
      sublabel: '320 × 180 (16:9)',
      url: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    },
    {
      id: 'frame_1',
      label: 'Video Frame 1',
      sublabel: 'Start scene capture',
      url: `https://img.youtube.com/vi/${id}/1.jpg`,
      badge: 'Scene 1',
    },
    {
      id: 'frame_2',
      label: 'Video Frame 2',
      sublabel: 'Middle scene capture',
      url: `https://img.youtube.com/vi/${id}/2.jpg`,
      badge: 'Scene 2',
    },
    {
      id: 'frame_3',
      label: 'Video Frame 3',
      sublabel: 'End scene capture',
      url: `https://img.youtube.com/vi/${id}/3.jpg`,
      badge: 'Scene 3',
    },
  ];
}

/**
 * Convert a File object to a Base64 Data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Client-side auto-fit/canvas resizer to generate compliant 512x512 or 1024x500 images
 */
export function fitImageToCanvas(
  sourceUrl: string, 
  targetWidth: number, 
  targetHeight: number, 
  fit: 'cover' | 'contain' = 'cover',
  background: string = '#1e1e1e'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      
      let drawW = targetWidth;
      let drawH = targetHeight;
      let drawX = 0;
      let drawY = 0;

      if (fit === 'cover') {
        const scale = Math.max(targetWidth / srcW, targetHeight / srcH);
        drawW = srcW * scale;
        drawH = srcH * scale;
        drawX = (targetWidth - drawW) / 2;
        drawY = (targetHeight - drawH) / 2;
      } else {
        const scale = Math.min(targetWidth / srcW, targetHeight / srcH);
        drawW = srcW * scale;
        drawH = srcH * scale;
        drawX = (targetWidth - drawW) / 2;
        drawY = (targetHeight - drawH) / 2;
      }

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      resolve(canvas.toDataURL('image/webp', 0.85));
    };
    img.onerror = () => reject(new Error('Failed to load image for canvas formatting'));
    img.src = sourceUrl;
  });
}

/**
 * Intelligent Image Compressor for Firestore storage
 * Resizes any oversized image to maxDimension and compresses using WebP/JPEG
 * ensuring sizes stay between 15KB - 75KB per image.
 */
export async function compressImage(
  source: File | string,
  maxDimension: number = 1080,
  quality: number = 0.82
): Promise<string> {
  let sourceUrl = '';
  let isCreatedObjectUrl = false;

  if (source instanceof File) {
    sourceUrl = URL.createObjectURL(source);
    isCreatedObjectUrl = true;
  } else {
    sourceUrl = source;
    // If it's not a data url (e.g. https://... or empty), return as is
    if (!sourceUrl || (!sourceUrl.startsWith('data:image/') && !sourceUrl.startsWith('blob:'))) {
      return sourceUrl;
    }
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      if (isCreatedObjectUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          cleanup();
          resolve(typeof source === 'string' ? source : '');
          return;
        }

        // Calculate scaled dimensions
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanup();
          resolve(typeof source === 'string' ? source : '');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first for optimal byte-size / quality ratio
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(typeof source === 'string' ? source : '');
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(typeof source === 'string' ? source : '');
    };

    img.src = sourceUrl;
  });
}

/**
 * Optimizes all media in an app object before persisting to Firestore,
 * preventing document size from exceeding the 1MB Firestore write limit.
 */
export async function optimizeAppMediaForStorage(app: Record<string, any>): Promise<Record<string, any>> {
  const optimized = { ...app };

  try {
    // 1. Icon: Max 512x512
    if (optimized.iconUrl && optimized.iconUrl.startsWith('data:image/')) {
      optimized.iconUrl = await compressImage(optimized.iconUrl, 512, 0.85);
    }

    // 2. Feature Graphic: Exact 16:9 up to 1920px
    if (optimized.featureGraphicUrl && optimized.featureGraphicUrl.startsWith('data:image/')) {
      optimized.featureGraphicUrl = await compressImage(optimized.featureGraphicUrl, 1920, 0.85);
    }

    // 2.1 Details Banner: Exact 16:9 up to 1920px
    if (optimized.detailsBannerUrl && optimized.detailsBannerUrl.startsWith('data:image/')) {
      optimized.detailsBannerUrl = await compressImage(optimized.detailsBannerUrl, 1920, 0.85);
    }

    // 2.2 Hero Banner: Exact 16:9 up to 1920px
    if (optimized.heroBannerUrl && optimized.heroBannerUrl.startsWith('data:image/')) {
      optimized.heroBannerUrl = await compressImage(optimized.heroBannerUrl, 1920, 0.85);
    }

    // 2.5 Video Custom Thumbnail: Max 1080px
    if (optimized.videoThumbnailUrl && typeof optimized.videoThumbnailUrl === 'string' && optimized.videoThumbnailUrl.startsWith('data:image/')) {
      optimized.videoThumbnailUrl = await compressImage(optimized.videoThumbnailUrl, 1080, 0.80);
    }

    // 3. Screenshots (Phone): Max 8 items, max 1080px
    if (Array.isArray(optimized.screenshots) && optimized.screenshots.length > 0) {
      const limitedScreenshots = optimized.screenshots.slice(0, 8);
      optimized.screenshots = await Promise.all(
        limitedScreenshots.map(async (shot: string) => {
          if (shot && typeof shot === 'string' && shot.startsWith('data:image/')) {
            return await compressImage(shot, 1080, 0.80);
          }
          return shot;
        })
      );
    }

    // 4. Screenshots (Tablet): Max 4 items, max 1080px
    if (Array.isArray(optimized.tabletScreenshots) && optimized.tabletScreenshots.length > 0) {
      const limitedTablet = optimized.tabletScreenshots.slice(0, 4);
      optimized.tabletScreenshots = await Promise.all(
        limitedTablet.map(async (shot: string) => {
          if (shot && typeof shot === 'string' && shot.startsWith('data:image/')) {
            return await compressImage(shot, 1080, 0.80);
          }
          return shot;
        })
      );
    }

    // 5. Screenshots (Desktop): Max 4 items, max 1080px
    if (Array.isArray(optimized.desktopScreenshots) && optimized.desktopScreenshots.length > 0) {
      const limitedDesktop = optimized.desktopScreenshots.slice(0, 4);
      optimized.desktopScreenshots = await Promise.all(
        limitedDesktop.map(async (shot: string) => {
          if (shot && typeof shot === 'string' && shot.startsWith('data:image/')) {
            return await compressImage(shot, 1080, 0.80);
          }
          return shot;
        })
      );
    }
  } catch (err) {
    console.warn('[MediaOptimization] Error optimizing media for storage:', err);
  }

  return optimized;
}

