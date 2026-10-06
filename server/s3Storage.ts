import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Default S3 configuration for the user's verified bucket
export const S3_BUCKET_NAME = process.env.AWS_S3_BUCKET || "prople";
export const S3_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
export const S3_BASE_URL = `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com`;

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    // If AWS credentials aren't set in environment, S3 client will rely on IAM role or fail gracefully
    try {
      if (!s3ClientInstance) {
        s3ClientInstance = new S3Client({ region: S3_REGION });
      }
      return s3ClientInstance;
    } catch {
      return null;
    }
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Generate a pre-signed URL for direct browser-to-S3 upload
 */
export async function createS3UploadPresignedUrl(
  key: string,
  contentType: string = "image/webp",
  expiresInSeconds: number = 900
): Promise<{ uploadUrl: string; publicUrl: string } | null> {
  const client = getS3Client();
  if (!client) return null;

  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    const publicUrl = `${S3_BASE_URL}/${key}`;

    return { uploadUrl, publicUrl };
  } catch (err: any) {
    console.error("[S3] Failed to generate presigned URL:", err.message);
    return null;
  }
}

/**
 * Direct server-side upload to S3 for buffers or base64 data
 */
export async function uploadBufferToS3(
  buffer: Buffer,
  key: string,
  contentType: string = "image/webp"
): Promise<string | null> {
  const client = getS3Client();
  if (!client) return null;

  try {
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await client.send(command);
    return `${S3_BASE_URL}/${key}`;
  } catch (err: any) {
    console.error("[S3] Direct upload failed:", err.message);
    return null;
  }
}
