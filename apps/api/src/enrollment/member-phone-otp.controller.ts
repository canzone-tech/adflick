import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { MemberPhoneOtpService } from './member-phone-otp.service';
import { RequestMemberPhoneOtpDto, VerifyMemberPhoneOtpDto } from './member-phone-otp.dto';

@Controller('member-enrollment/phone')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class MemberPhoneOtpController {
  constructor(private readonly phone: MemberPhoneOtpService) {}
  @Get('configuration')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR_COMPLIANCE)
  configuration(@CurrentUser() actor: AuthenticatedUser) { return this.phone.configuration(actor); }

  @Get('status')
  @Roles(UserRole.MEMBER)
  status(@CurrentUser() actor: AuthenticatedUser) { return this.phone.status(actor); }

  @Post('request')
  @Roles(UserRole.MEMBER)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  request(@CurrentUser() actor: AuthenticatedUser, @Body() dto: RequestMemberPhoneOtpDto) {
    return this.phone.request(actor, dto);
  }

  @Post('verify')
  @Roles(UserRole.MEMBER)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@CurrentUser() actor: AuthenticatedUser, @Body() dto: VerifyMemberPhoneOtpDto) {
    return this.phone.verify(actor, dto);
  }
}
