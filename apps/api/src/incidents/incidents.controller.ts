import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IncidentStatus, UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post('scan-alerts')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  scanAlerts(@CurrentUser() actor: AuthenticatedUser) { return this.incidents.scanAlerts(actor); }

  @Get('summary')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT, UserRole.AUDITOR_COMPLIANCE, UserRole.FINANCE_MANAGER)
  summary(@CurrentUser() actor: AuthenticatedUser) { return this.incidents.summary(actor); }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT, UserRole.AUDITOR_COMPLIANCE, UserRole.FINANCE_MANAGER)
  list(@CurrentUser() actor: AuthenticatedUser, @Query('status') status?: IncidentStatus) {
    return this.incidents.list(actor, status);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateIncidentDto) {
    return this.incidents.create(actor, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.SUPPORT_AGENT)
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateIncidentDto) {
    return this.incidents.update(actor, id, dto);
  }
}
