import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  root() {
    return {
      name: 'ADFLICK PLAYOUT CMS API',
      version: '0.1.0',
      status: 'running',
      docs: 'API documentation will be added in a later batch.',
    };
  }

  /** Liveness probe: proves the process can serve requests, not that dependencies are ready. */
  @Get('health')
  health() {
    return { api: 'ok', timestamp: new Date().toISOString() };
  }

  /** Readiness probe: reports only a generic failure to callers; never exposes connection details. */
  @Get('ready')
  async readiness(@Res() response: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return response.status(200).json({ status: 'ready', checks: { database: 'ok' } });
    } catch {
      return response.status(503).json({ status: 'not_ready', checks: { database: 'unavailable' } });
    }
  }
}
