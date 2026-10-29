import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import * as sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

const IMAGE_MIME: Record<string,string> = {
  jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
};
export const IMAGE_VERIFY_MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;

export async function inspectTrustedImage(bytes: Buffer, claimedMime: string, claimedHash: string) {
  if (!bytes.length || bytes.length > IMAGE_VERIFY_MAX_BYTES) {
    throw new BadRequestException('Image byte length exceeds verifier limits.');
  }
  if (!/^[a-f0-9]{64}$/i.test(claimedHash)) throw new BadRequestException('Claimed SHA-256 is invalid.');
  const digest = createHash('sha256').update(bytes).digest();
  const claimed = Buffer.from(claimedHash, 'hex');
  if (claimed.length !== digest.length || !timingSafeEqual(digest, claimed)) {
    throw new BadRequestException('Stored bytes do not match claimed SHA-256.');
  }
  const metadata = await sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).metadata();
  if (!metadata.format || IMAGE_MIME[metadata.format] !== claimedMime ||
      !metadata.width || !metadata.height ||
      metadata.width * metadata.height > MAX_PIXELS ||
      metadata.pages !== undefined && metadata.pages > 1) {
    throw new BadRequestException('Unsupported or unsafe image content.');
  }
  // Metadata alone is insufficient: decode actual pixels before trusting bytes.
  await sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: 'error' }).stats();
  return { width: metadata.width, height: metadata.height, checksumSha256: digest.toString('hex') };
}

/**
 * Explicit, trusted, *opt-in* image verification; never invoked by the public
 * upload-complete endpoint or a scheduler. Does not approve audio/video.
 */
@Injectable()
export class MediaVerificationService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  async verifyOne(organizationId: string, assetId: string) {
    if (process.env.MEDIA_VERIFICATION_ENABLED !== '1') {
      throw new ForbiddenException('Trusted media verification is disabled.');
    }
    if (!organizationId || !assetId) throw new BadRequestException('Organization and asset IDs are required.');
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { organizationId, id: assetId, status: 'PROCESSING' },
      select: {
        id: true, organizationId: true, storageKey: true,
        mimeType: true, checksumSha256: true, sizeBytes: true,
      },
    });
    if (!asset) throw new NotFoundException('No PROCESSING asset in this organization.');
    if (!asset.storageKey || !asset.storageKey.startsWith(organizationId + '/incoming/') ||
        !asset.checksumSha256) throw new BadRequestException('Media lacks trusted storage metadata.');
    if (!Object.values(IMAGE_MIME).includes(asset.mimeType)) {
      throw new BadRequestException('Only JPEG, PNG and WebP can be verified in this worker; other media stays PROCESSING.');
    }
    if (asset.sizeBytes <= 0n || asset.sizeBytes > BigInt(IMAGE_VERIFY_MAX_BYTES)) {
      throw new BadRequestException('Media exceeds trusted image verification limits.');
    }
    const object = await this.storage.readVerificationObject(asset.storageKey, IMAGE_VERIFY_MAX_BYTES);
    if (BigInt(object.bytes.length) !== asset.sizeBytes) throw new BadRequestException('Stored object length mismatch.');
    const verified = await inspectTrustedImage(object.bytes, asset.mimeType, asset.checksumSha256);
    const updated = await this.prisma.mediaAsset.updateMany({
      where: { id: asset.id, organizationId, status: 'PROCESSING', checksumSha256: verified.checksumSha256 },
      data: { status: 'READY', width: verified.width, height: verified.height },
    });
    if (updated.count !== 1) throw new BadRequestException('Asset changed during verification; no READY transition.');
    await this.prisma.auditEvent.create({ data: {
      organizationId, action: 'TRUSTED_MEDIA_IMAGE_VERIFIED',
      entityType: 'MediaAsset', entityId: asset.id,
      metadataJson: { width: verified.width, height: verified.height, algorithm: 'SHA256_BYTES_AND_DECODE' },
    } });
    return { assetId: asset.id, status: 'READY', width: verified.width, height: verified.height };
  }
}
