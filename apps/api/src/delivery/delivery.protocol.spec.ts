import { createHash } from 'node:crypto';
import { ForbiddenException, NotAcceptableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../cms/storage.service';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';

describe('Authenticated cross-platform player protocol v1', () => {
  const secret = 'valid-device-credential-that-is-long-enough';
  const screen = {
    id: 'screen-a', organizationId: 'org-a', name: 'Lobby',
    platform: 'Google TV', devicePlatform: 'Android TV',
    deviceKeyHash: createHash('sha256').update(secret).digest('hex'),
    status: 'ONLINE',
  };
  const prisma = {
    screen: { findUnique: jest.fn() },
    campaign: { findMany: jest.fn() },
    playbackAuthorization: { create: jest.fn(), deleteMany: jest.fn() },
    screenPlaylistAssignment: { findMany: jest.fn() },
  };
  const storage = { createDownloadUrl: jest.fn() };
  const service = new DeliveryService(
    prisma as unknown as PrismaService, storage as unknown as StorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.screen.findUnique.mockResolvedValue(screen);
  });

  it('returns a scoped versioned API contract without issuing playback grants or secrets', async () => {
    const result = await service.getProtocol(screen.id, secret, '1');
    expect(prisma.screen.findUnique).toHaveBeenCalledWith({ where: { id: screen.id } });
    expect(result).toEqual({
      protocolVersion: 1,
      manifestSchemaVersion: 1,
      screen: { id: 'screen-a', platform: 'Android TV' },
      authentication: { scheme: 'DEVICE_SECRET', header: 'x-device-secret' },
      endpoints: {
        manifest: '/api/v1/devices/screen-a/manifest',
        heartbeat: '/api/v1/devices/screen-a/heartbeat',
        playbackEvents: '/api/v1/devices/screen-a/playback/events',
        commands: '/api/v1/devices/screen-a/commands',
      },
      telemetry: { playbackAuthorizationRequired: true, evidence: 'SELF_REPORTED_ONLY' },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(screen.deviceKeyHash);
    expect(JSON.stringify(result)).not.toContain('org-a');
    expect(prisma.campaign.findMany).not.toHaveBeenCalled();
    expect(prisma.playbackAuthorization.create).not.toHaveBeenCalled();
    expect(prisma.playbackAuthorization.deleteMany).not.toHaveBeenCalled();
    expect(storage.createDownloadUrl).not.toHaveBeenCalled();
  });

  it('supports unversioned v1 clients and configured platform fallback', async () => {
    prisma.screen.findUnique.mockResolvedValue({ ...screen, devicePlatform: null });
    const result = await service.getProtocol(screen.id, secret);
    expect(result.protocolVersion).toBe(1);
    expect(result.screen.platform).toBe('Google TV');
  });

  it.each(['2', '0', 'latest', '', '1,2'])(
    'rejects requested protocol version %p after authenticating', async (version) => {
      await expect(service.getProtocol(screen.id, secret, version))
        .rejects.toBeInstanceOf(NotAcceptableException);
      expect(prisma.screen.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.playbackAuthorization.create).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown, unpaired, suspended and retired devices', async () => {
    for (const status of ['PENDING_PAIRING', 'SUSPENDED', 'RETIRED']) {
      prisma.screen.findUnique.mockResolvedValue({ ...screen, status });
      await expect(service.getProtocol(screen.id, secret)).rejects.toBeInstanceOf(ForbiddenException);
    }
    prisma.screen.findUnique.mockResolvedValue(null);
    await expect(service.getProtocol(screen.id, secret)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.playbackAuthorization.create).not.toHaveBeenCalled();
  });

  it('rejects missing, wrong and another screen\'s device credentials', async () => {
    await expect(service.getProtocol(screen.id, '')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getProtocol(screen.id, 'another-valid-length-device-secret-but-wrong'))
      .rejects.toBeInstanceOf(ForbiddenException);
    prisma.screen.findUnique.mockResolvedValue({ ...screen, deviceKeyHash: '00'.repeat(32) });
    await expect(service.getProtocol(screen.id, secret)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.campaign.findMany).not.toHaveBeenCalled();
    expect(prisma.playbackAuthorization.create).not.toHaveBeenCalled();
  });

  it('maps the device-authenticated controller route to the service without a staff JWT', async () => {
    const controller = new DeliveryController(service);
    const result = await controller.protocol(screen.id, secret, '1');
    expect(result.protocolVersion).toBe(1);
    expect(result.telemetry.evidence).toBe('SELF_REPORTED_ONLY');
  });
});
