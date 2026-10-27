import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { MemberEmailOtpService } from './member-email-otp.service';
import { UpdateMemberOtpPolicyDto, VerifyMemberEmailOtpDto } from './member-email-otp.dto';

@Controller('member-enrollment/otp')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class MemberEmailOtpController {
  constructor(private readonly otp: MemberEmailOtpService) {}

  @Get('policy')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR_COMPLIANCE)
  policy(@CurrentUser() actor: AuthenticatedUser) { return this.otp.policy(actor); }

  @Put('policy')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  updatePolicy(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdateMemberOtpPolicyDto) {
    return this.otp.updatePolicy(actor, dto);
  }

  @Get('status')
  @Roles(UserRole.MEMBER)
  status(@CurrentUser() actor: AuthenticatedUser) { return this.otp.status(actor); }

  @Post('request')
  @Roles(UserRole.MEMBER)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  request(@CurrentUser() actor: AuthenticatedUser) { return this.otp.request(actor); }

  @Post('verify')
  @Roles(UserRole.MEMBER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@CurrentUser() actor: AuthenticatedUser, @Body() dto: VerifyMemberEmailOtpDto) {
    return this.otp.verify(actor, dto);
  }
}
