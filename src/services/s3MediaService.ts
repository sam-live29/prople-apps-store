/**
 * Client-side S3 Media Storage Service
 * Handles uploading images and media directly to AWS S3 (`prople` bucket in `ap-south-1`)
 * or through the server proxy if direct upload isn't accessible.
 */

import { safeFetchJson } from '../utils/safeFetch';

export interface S3UploadResult {
  url: string;
  key?: string;
  source: 's3-direct' | 's3-proxy' | 'fallback-data-url';
}

/**
 * Upload an image (Data URL or File) to AWS S3
 * Automatically attempts:
 * 1. Pre-signed direct browser-to-S3 upload (fastest, zero server load)
 * 2. Server proxy streaming to S3
 * 3. Fallback to optimized compressed data URL if AWS is temporarily offline
 */
export async function uploadMediaToS3(
  source: File | string,
  filename: string,
  folder: string = 'apps'
): Promise<string> {
  // If it's already an external HTTP/HTTPS URL, don't re-upload
  if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))) {
    return source;
  }

  let contentType = 'image/webp';
  let binaryBlob: Blob | null = null;
  let dataUrlString: string = '';

  if (source instanceof File) {
    contentType = source.type || 'image/webp';
    binaryBlob = source;
  } else if (typeof source === 'string' && source.startsWith('data:')) {
    dataUrlString = source;
    const match = source.match(/^data:([^;]+);base64,/);
    if (match) contentType = match[1];

    try {
      const byteCharacters = atob(source.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      binaryBlob = new Blob([byteArray], { type: contentType });
    } catch {
      // Fallback
    }
  }

  // Attempt 1: Pre-signed direct upload to AWS S3
  try {
    const { ok, data: presignedData } = await safeFetchJson<{ success: boolean; uploadUrl?: string; publicUrl?: string }>(
      '/api/storage/presigned-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, contentType, folder }),
      }
    );

    if (ok && presignedData?.success && presignedData.uploadUrl && binaryBlob) {
      const uploadRes = await fetch(presignedData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: binaryBlob,
      });

      if (uploadRes.ok && presignedData.publicUrl) {
        return presignedData.publicUrl;
      }
    }
  } catch (err) {
    console.warn('[S3 Client] Presigned direct upload failed, attempting proxy upload:', err);
  }

  // Attempt 2: Server-side proxy stream to AWS S3
  if (dataUrlString || binaryBlob) {
    try {
      if (!dataUrlString && binaryBlob) {
        dataUrlString = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(binaryBlob!);
        });
      }

      const { ok, data: proxyData } = await safeFetchJson<{ success: boolean; url?: string }>(
        '/api/storage/upload',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: dataUrlString, filename, folder }),
        }
      );

      if (ok && proxyData?.success && proxyData.url) {
        return proxyData.url;
      }
    } catch (err) {
      console.warn('[S3 Client] Proxy S3 upload failed:', err);
    }
  }

  // Attempt 3: Safe fallback to the compressed Data URL
  return dataUrlString || (typeof source === 'string' ? source : '');
}
