/**
 * R2 storage helpers: presigned upload URLs & object operations
 */
import { generateId, extFromContentType } from './utils';

export type R2Bucket = import('@cloudflare/workers-types').R2Bucket;

export type PresignRequest = {
    type: 'payment_proof' | 'receipt';
    period: string;
    content_type: string;
    propertyId: string;
};

/**
 * Generate an R2 object key following the naming convention.
 * Actual upload is done by the frontend via a Workers route or direct R2 custom domain.
 */
export function generateObjectKey(req: PresignRequest): string {
    const folder = req.type === 'payment_proof' ? 'payment_proofs' : 'receipts';
    const ext = extFromContentType(req.content_type);
    const fileId = generateId();
    return `${folder}/${req.propertyId}/${req.period}/${fileId}.${ext}`;
}

/**
 * Upload a file to R2 directly from the Worker (used by OCR to read files, etc.)
 */
export async function putObject(
    bucket: R2Bucket,
    key: string,
    body: ArrayBuffer | ReadableStream,
    contentType: string
) {
    return bucket.put(key, body, {
        httpMetadata: { contentType },
    });
}

/**
 * Read an object from R2 (used by OCR to fetch receipt image)
 */
export async function getObject(bucket: R2Bucket, key: string) {
    return bucket.get(key);
}

/**
 * Generate a "presign-like" response. Because R2 doesn't natively support
 * presigned URLs from Workers, we return the object key and the frontend
 * will PUT the file to a dedicated upload endpoint on this Worker.
 */
export function presignResponse(objectKey: string) {
    return {
        object_key: objectKey,
        upload_url: `/api/uploads/${encodeURIComponent(objectKey)}`,
        method: 'PUT',
        expires_in: 3600,
    };
}
