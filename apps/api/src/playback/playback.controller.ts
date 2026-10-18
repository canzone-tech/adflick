import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PlaybackService } from './playback.service';
import { PlaybackBatchDto } from './dto/playback-batch.dto';

@Controller('devices/:id/playback')
@UseGuards(ThrottlerGuard)
export class DevicePlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  @Post('events')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  ingest(
    @Param('id') id: string,
    @Headers('x-device-secret') secret: string,
    @Body() body: PlaybackBatchDto,
  ) {
    return this.playback.ingestBatch(id, secret, body.events);
  }
}

@Controller('reports/playback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlaybackReportsController {
  constructor(private readonly playback: PlaybackService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FINANCE_MANAGER, UserRole.AUDITOR_COMPLIANCE)
  report(@CurrentUser() actor: AuthenticatedUser, @Query('screenId') screenId?: string) {
    return this.playback.report(actor, screenId);
  }
}
