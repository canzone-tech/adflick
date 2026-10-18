import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { ReviewCampaignDto } from './dto/review-campaign.dto';

const MANAGE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.ADVERTISER, UserRole.CONTENT_MANAGER, UserRole.OPERATIONS_MANAGER];
@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @Roles(...MANAGE_ROLES, UserRole.FINANCE_MANAGER, UserRole.AUDITOR_COMPLIANCE)
  list(@CurrentUser() actor: AuthenticatedUser) { return this.campaigns.list(actor); }

  @Get(':id')
  @Roles(...MANAGE_ROLES, UserRole.FINANCE_MANAGER, UserRole.AUDITOR_COMPLIANCE)
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.campaigns.get(actor, id); }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateCampaignDto) { return this.campaigns.create(actor, dto); }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(actor, id, dto);
  }

  @Post(':id/submit')
  @Roles(...MANAGE_ROLES)
  submit(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.campaigns.submit(actor, id); }

  @Post(':id/approve')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  approve(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewCampaignDto) {
    return this.campaigns.approve(actor, id, dto.note);
  }

  @Post(':id/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  reject(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewCampaignDto) {
    return this.campaigns.reject(actor, id, dto.note);
  }

  @Post(':id/schedule')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  schedule(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.campaigns.schedule(actor, id); }

  @Post(':id/pause')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  pause(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.campaigns.transition(actor, id, 'pause'); }

  @Post(':id/resume')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  resume(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.campaigns.transition(actor, id, 'resume'); }

  @Post(':id/complete')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.OPERATIONS_MANAGER)
  complete(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.campaigns.transition(actor, id, 'complete'); }
}
