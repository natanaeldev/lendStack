/**
 * S3 document storage — replaces Vercel Blob.
 *
 * All borrower documents are stored in a private S3 bucket encrypted with KMS.
 * Objects are never publicly accessible. Access is always via presigned URLs
 * with a short TTL (15 minutes) generated server-side after session validation.
 *
 * The ECS task role (not long-lived keys) grants access. In local dev, either:
 *   - Use AWS_PROFILE / standard credential chain (preferred)
 *   - Use LocalStack for offline development
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ─── Client ──────────────────────────────────────────────────────────────────
// In ECS Fargate, credentials come from the task role via instance metadata.
// In local dev, credentials come from ~/.aws/credentials or environment vars.
// No credentials are ever hardcoded.

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' })

const BUCKET = process.env.AWS_S3_DOCUMENTS_BUCKET
if (!BUCKET && process.env.NODE_ENV === 'production') {
  throw new Error('AWS_S3_DOCUMENTS_BUCKET env var is required in production')
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadResult {
  key: string
  bucket: string
  size: number
  contentType: string
}

// ─── Key naming convention ────────────────────────────────────────────────────
// org/{orgId}/clients/{clientId}/docs/{timestamp}-{filename}
// Keeps objects organized and makes IAM path-based policies easy to apply later.

export function buildObjectKey(
  orgId: string,
  clientId: string,
  filename: string
): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._\-]/g, '_')
  return `org/${orgId}/clients/${clientId}/docs/${Date.now()}-${sanitized}`
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadDocument(
  orgId: string,
  clientId: string,
  file: File
): Promise<UploadResult> {
  if (!BUCKET) throw new Error('S3 bucket not configured')

  const key = buildObjectKey(orgId, clientId, file.name)
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(new PutObjectCommand({
    Bucket:               BUCKET,
    Key:                  key,
    Body:                 buffer,
    ContentType:          file.type,
    ContentLength:        file.size,
    ContentDisposition:   `attachment; filename="${file.name}"`,
    // SSE-KMS is enforced at the bucket level via bucket policy.
    // Explicitly set it here as a belt-and-suspenders measure.
    ServerSideEncryption: 'aws:kms',
    // Tag for lifecycle, audit, and cost allocation
    Tagging:              `orgId=${orgId}&clientId=${clientId}`,
    Metadata: {
      originalName: encodeURIComponent(file.name),
      uploadedBy:   orgId,
    },
  }))

  return { key, bucket: BUCKET, size: file.size, contentType: file.type }
}

// ─── Presigned download URL (15-minute TTL) ───────────────────────────────────
// Never return the S3 URL directly. Always go through this function.
// The caller MUST have verified the document belongs to the requesting org
// before calling this — authorization is the API route's responsibility.

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 900  // 15 minutes
): Promise<string> {
  if (!BUCKET) throw new Error('S3 bucket not configured')

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key:    key,
    // Force browser to download (not render inline) — prevents XSS from HTML documents
    ResponseContentDisposition: 'attachment',
  })

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
}

// ─── Presigned upload URL (direct browser → S3 upload) ───────────────────────
// Optional: for large files, let the browser upload directly to S3
// instead of routing through the Next.js server. Reduces ECS memory pressure.
// The API generates the presigned URL; the browser uploads; the API records metadata.

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  maxBytes: number,
  expiresInSeconds = 300  // 5 minutes to complete the upload
): Promise<string> {
  if (!BUCKET) throw new Error('S3 bucket not configured')

  const command = new PutObjectCommand({
    Bucket:               BUCKET,
    Key:                  key,
    ContentType:          contentType,
    ServerSideEncryption: 'aws:kms',
    // Conditions enforced server-side — browser cannot bypass them
    ContentLength:        maxBytes,
  })

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
}

// ─── Delete ───────────────────────────────────────────────────────────────────
// Soft-delete is handled by S3 versioning — the object becomes a delete marker.
// Previous versions are recoverable for the configured retention period.

export async function deleteDocument(key: string): Promise<void> {
  if (!BUCKET) throw new Error('S3 bucket not configured')

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// ─── Existence check ──────────────────────────────────────────────────────────

export async function documentExists(key: string): Promise<boolean> {
  if (!BUCKET) return false

  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}

// ─── Feature flag ────────────────────────────────────────────────────────────
// Allows graceful fallback to base64 in local dev without S3 configured.

export const isS3Configured = () =>
  !!(process.env.AWS_S3_DOCUMENTS_BUCKET && process.env.AWS_REGION)
