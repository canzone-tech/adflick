import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';

describe('HealthController', () => {
  const makeController = async (queryRaw = jest.fn().mockResolvedValue([{ 1: 1 }])) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();
    return moduleRef.get(HealthController);
  };

  it('returns service identity from root endpoint handler', async () => {
    const controller = await makeController();
    expect(controller.root()).toMatchObject({
      name: 'ADFLICK PLAYOUT CMS API',
      version: '0.1.0',
      status: 'running',
    });
  });

  it('liveness does not depend on database availability', async () => {
    const controller = await makeController(jest.fn().mockRejectedValue(new Error('db offline')));
    expect(controller.health()).toMatchObject({ api: 'ok' });
  });

  it('returns 200 when the database readiness query succeeds', async () => {
    const controller = await makeController();
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await controller.readiness(response);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ status: 'ready', checks: { database: 'ok' } });
  });

  it('returns sanitized 503 when the database readiness query fails', async () => {
    const controller = await makeController(jest.fn().mockRejectedValue(new Error('secret connection detail')));
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    await controller.readiness(response);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ status: 'not_ready', checks: { database: 'unavailable' } });
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('secret connection detail');
  });
});
