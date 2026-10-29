import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { inspectTrustedImage, MediaVerificationService } from './media-verification.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

describe('Trusted image worker (opt-in; no public READY shortcut)', () => {
  let png: Buffer, hash: string;
  const previous = process.env.MEDIA_VERIFICATION_ENABLED;
  beforeAll(async () => {
    png = await sharp({ create: { width: 8, height: 5, channels: 3, background: '#ef3340' } }).png().toBuffer();
    hash = createHash('sha256').update(png).digest('hex');
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.MEDIA_VERIFICATION_ENABLED;
    else process.env.MEDIA_VERIFICATION_ENABLED = previous;
  });

  it('decodes actual pixels and verifies exact SHA-256 / dimensions', async () => {
    await expect(inspectTrustedImage(png, 'image/png', hash)).resolves.toEqual({
      width: 8, height: 5, checksumSha256: hash,
    });
    await expect(inspectTrustedImage(png, 'image/jpeg', hash)).rejects.toThrow();
    await expect(inspectTrustedImage(png, 'image/png', '0'.repeat(64))).rejects.toThrow();
    await expect(inspectTrustedImage(Buffer.from('not an image'), 'image/png',
      createHash('sha256').update('not an image').digest('hex'))).rejects.toThrow();
  });

  it('refuses verification by default, with no storage call or READY mutation', async () => {
    delete process.env.MEDIA_VERIFICATION_ENABLED;
    const db = { mediaAsset: { findFirst: jest.fn(), updateMany: jest.fn() } };
    const store = { readVerificationObject: jest.fn() };
    const worker = new MediaVerificationService(db as unknown as PrismaService, store as unknown as StorageService);
    await expect(worker.verifyOne('org', 'asset')).rejects.toThrow('disabled');
    expect(db.mediaAsset.findFirst).not.toHaveBeenCalled();
    expect(store.readVerificationObject).not.toHaveBeenCalled();
  });

  it('verifies only tenant-scoped PROCESSING image and atomically marks READY with audit', async () => {
    process.env.MEDIA_VERIFICATION_ENABLED = '1';
    const db = {
      mediaAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset', organizationId: 'org', storageKey: 'org/incoming/asset.png',
          mimeType: 'image/png', checksumSha256: hash, sizeBytes: BigInt(png.length),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'event' }) },
    };
    const store = { readVerificationObject: jest.fn().mockResolvedValue({ bytes: png }) };
    const worker = new MediaVerificationService(db as unknown as PrismaService, store as unknown as StorageService);
    await expect(worker.verifyOne('org', 'asset')).resolves.toMatchObject({ status: 'READY', width: 8, height: 5 });
    expect(db.mediaAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org', id: 'asset', status: 'PROCESSING' },
    }));
    expect(db.mediaAsset.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'asset', organizationId: 'org', status: 'PROCESSING', checksumSha256: hash },
      data: { status: 'READY', width: 8, height: 5 },
    }));
    expect(db.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(store.readVerificationObject).toHaveBeenCalledWith('org/incoming/asset.png', expect.any(Number));
  });

  it('never marks READY for wrong storage tenant, mismatched bytes or unsupported video', async () => {
    process.env.MEDIA_VERIFICATION_ENABLED = '1';
    const row = { id: 'asset', organizationId: 'org',
      storageKey: 'foreign/incoming/evil.png', mimeType: 'image/png',
      checksumSha256: hash, sizeBytes: BigInt(png.length) };
    const db = {
      mediaAsset: { findFirst: jest.fn().mockResolvedValue(row), updateMany: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const store = { readVerificationObject: jest.fn().mockResolvedValue({ bytes: Buffer.from('bad') }) };
    const worker = new MediaVerificationService(db as unknown as PrismaService, store as unknown as StorageService);
    await expect(worker.verifyOne('org', 'asset')).rejects.toThrow('trusted storage');
    row.storageKey = 'org/incoming/asset.png';
    await expect(worker.verifyOne('org', 'asset')).rejects.toThrow('length mismatch');
    row.mimeType = 'video/mp4';
    await expect(worker.verifyOne('org', 'asset')).rejects.toThrow('Only JPEG');
    expect(db.mediaAsset.updateMany).not.toHaveBeenCalled();
    expect(db.auditEvent.create).not.toHaveBeenCalled();
  });
});
