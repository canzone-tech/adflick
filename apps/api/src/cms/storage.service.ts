import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly bucket = process.env.S3_BUCKET;
  private readonly client?: S3Client;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION ?? 'auto';
    if (this.bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
      this.client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        forcePathStyle: Boolean(endpoint),
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      });
    }
  }

  private requireConfig(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException('Object storage is not configured. Configure S3-compatible storage before uploading media.');
    }
    return { client: this.client, bucket: this.bucket };
  }

  async createUploadUrl(key: string, mimeType: string, sizeBytes: number) {
    const { client, bucket } = this.requireConfig();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
      Metadata: { 'expected-size-bytes': String(sizeBytes) },
    });
    return getSignedUrl(client, command, { expiresIn: 300 });
  }

  async createDownloadUrl(key: string) {
    const { client, bucket } = this.requireConfig();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  }

  // Trusted worker only. Read a bounded object stream; never trust upload claims.
  async readVerificationObject(key: string, maxBytes: number): Promise<{ bytes: Buffer }> {
    const { client, bucket } = this.requireConfig();
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (response.ContentLength !== undefined && response.ContentLength > maxBytes) {
      throw new BadRequestException('Stored media exceeds verifier byte limit.');
    }
    if (!response.Body) throw new BadRequestException('Stored media has no readable body.');
    const chunks: Buffer[] = [];
    let count = 0;
    for await (const part of response.Body as AsyncIterable<Uint8Array>) {
      const chunk = Buffer.from(part);
      count += chunk.length;
      if (count > maxBytes) throw new BadRequestException('Stored media stream exceeds verifier byte limit.');
      chunks.push(chunk);
    }
    return { bytes: Buffer.concat(chunks, count) };
  }

  async deleteObject(key: string) {
    const { client, bucket } = this.requireConfig();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
