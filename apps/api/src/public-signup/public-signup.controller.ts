import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { PublicSignupStartDto, PublicSignupVerifyDto, PublicSignupPolicyDto } from './public-signup.dto';
import { PublicSignupService } from './public-signup.service';

@Controller('public-signup')
@UseGuards(ThrottlerGuard)
export class PublicSignupController {
  constructor(private readonly signup: PublicSignupService) {}

  @Get('organizations/:slug')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  organization(@Param('slug') slug: string) { return this.signup.organization(slug); }

  @Post('start')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  start(@Body() dto: PublicSignupStartDto) { return this.signup.start(dto); }

  @Post('verify')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  verify(@Body() dto: PublicSignupVerifyDto) { return this.signup.verify(dto); }
}

@Controller('admin/public-signup')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class PublicSignupAdminController {
  constructor(private readonly signup: PublicSignupService) {}

  @Get('policy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.AUDITOR_COMPLIANCE)
  policy(@CurrentUser() actor: AuthenticatedUser) { return this.signup.readPolicy(actor); }

  @Put('policy')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  update(@CurrentUser() actor: AuthenticatedUser, @Body() dto: PublicSignupPolicyDto) {
    return this.signup.updatePolicy(actor, dto);
  }
}
