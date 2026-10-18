import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AssetStatus, UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateLayoutDto } from './dto/create-layout.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { CmsService } from './cms.service';

const CMS_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.ADVERTISER,
  UserRole.CONTENT_MANAGER, UserRole.OPERATIONS_MANAGER,
];

@Controller('cms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get('assets')
  @Roles(...CMS_ROLES)
  listAssets(@CurrentUser() actor: AuthenticatedUser) {
    return this.cms.listAssets(actor);
  }

  @Post('assets')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.ADVERTISER, UserRole.CONTENT_MANAGER)
  createAsset(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateAssetDto) {
    return this.cms.createAsset(actor, dto);
  }

  @Post('assets/:id/complete-upload')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.CONTENT_MANAGER)
  completeUpload(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() body: CompleteUploadDto) {
    return this.cms.markAssetReady(actor, id, body.checksumSha256);
  }

  @Patch('assets/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.CONTENT_MANAGER)
  updateAssetStatus(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateAssetStatusDto) {
    return this.cms.updateAssetStatus(actor, id, dto.status as AssetStatus);
  }

  @Get('layouts')
  @Roles(...CMS_ROLES)
  listLayouts(@CurrentUser() actor: AuthenticatedUser) {
    return this.cms.listLayouts(actor);
  }

  @Post('layouts')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.CONTENT_MANAGER)
  createLayout(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateLayoutDto) {
    return this.cms.createLayout(actor, dto);
  }

  @Post('layouts/:id/publish')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.CONTENT_MANAGER)
  publishLayout(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.cms.publishLayout(actor, id);
  }

  @Get('playlists')
  @Roles(...CMS_ROLES)
  listPlaylists(@CurrentUser() actor: AuthenticatedUser) {
    return this.cms.listPlaylists(actor);
  }

  @Post('playlists')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.CONTENT_MANAGER)
  createPlaylist(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreatePlaylistDto) {
    return this.cms.createPlaylist(actor, dto);
  }

  @Post('playlists/:id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.CONTENT_MANAGER)
  activatePlaylist(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.cms.activatePlaylist(actor, id);
  }
}
