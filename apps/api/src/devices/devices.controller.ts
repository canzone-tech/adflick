import {
  Body, Controller, Get, Headers, Ip, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DevicesService } from './devices.service';
import { CreateScreenDto } from './dto/create-screen.dto';
import { PairDeviceDto } from './dto/pair-device.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { CreateCommandDto } from './dto/create-command.dto';
import { CommandResultDto } from './dto/command-result.dto';
import { UpdateScreenStatusDto } from './dto/update-screen-status.dto';
import { AssignmentsService } from '../scheduler/assignments.service';
import { AssignPlaylistDto } from '../scheduler/dto/assign-playlist.dto';

@Controller('devices')
@UseGuards(ThrottlerGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  // Player endpoints use a per-device secret, not a user JWT.
  @Post('pair')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  pair(@Body() dto: PairDeviceDto) {
    return this.devices.pair(dto);
  }

  @Post(':id/heartbeat')
  heartbeat(
    @Param('id') id: string,
    @Headers('x-device-secret') secret: string,
    @Body() dto: HeartbeatDto,
    @Ip() ip: string,
  ) {
    return this.devices.heartbeat(id, secret, dto, ip);
  }

  @Get(':id/commands')
  commands(@Param('id') id: string, @Headers('x-device-secret') secret: string) {
    return this.devices.deviceCommands(id, secret);
  }

  @Post(':id/commands/:commandId/result')
  commandResult(
    @Param('id') id: string,
    @Param('commandId') commandId: string,
    @Headers('x-device-secret') secret: string,
    @Body() dto: CommandResultDto,
  ) {
    return this.devices.reportCommand(id, secret, commandId, dto);
  }
}

@Controller('fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FleetController {
  constructor(private readonly devices: DevicesService, private readonly assignments: AssignmentsService) {}

  @Get('health-summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT, UserRole.AUDITOR_COMPLIANCE)
  healthSummary(@CurrentUser() actor: AuthenticatedUser) {
    return this.devices.healthSummary(actor);
  }

  @Get('screens')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT, UserRole.AUDITOR_COMPLIANCE)
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.devices.listScreens(actor);
  }

  @Post('screens')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateScreenDto) {
    return this.devices.createScreen(actor, dto);
  }

  @Post('screens/:id/commands')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  command(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateCommandDto) {
    return this.devices.createCommand(actor, id, dto);
  }

  @Patch('screens/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  status(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() body: UpdateScreenStatusDto) {
    return this.devices.setScreenStatus(actor, id, body.status);
  }

  @Get('screens/:id/playlists')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.CONTENT_MANAGER, UserRole.AUDITOR_COMPLIANCE, UserRole.SUPPORT_AGENT)
  listPlaylists(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.assignments.list(actor, id);
  }

  @Post('screens/:id/playlists')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.CONTENT_MANAGER)
  assignPlaylist(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignPlaylistDto) {
    return this.assignments.assign(actor, id, dto);
  }

  @Patch('screens/:id/playlists/:assignmentId/disable')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.CONTENT_MANAGER)
  disablePlaylist(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('assignmentId') assignmentId: string) {
    return this.assignments.disable(actor, id, assignmentId);
  }
}
