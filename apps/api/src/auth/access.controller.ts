import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Controller('access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessController {
  @Get('admin-check')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  adminCheck(@CurrentUser() actor: AuthenticatedUser) {
    return { success: true, userId: actor.sub, message: 'Admin access granted.' };
  }
}
