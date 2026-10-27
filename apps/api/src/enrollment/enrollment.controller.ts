import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { EnrollmentService } from './enrollment.service';
import {
  ApprovalReferenceDto, CreateMemberPackageDto, CreateMemberConsentDto,
  IssueEnrollmentPinDto, RevokeEnrollmentPinDto, EnrollExistingMemberDto,
} from './enrollment.dto';
import { MemberListQueryDto } from '../members/members.dto';

const STAFF = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.AUDITOR_COMPLIANCE];

@Controller('member-enrollment')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class EnrollmentController {
  constructor(private readonly enrollment: EnrollmentService) {}

  @Get('recipient')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  recipient(@CurrentUser() actor: AuthenticatedUser, @Query('email') email: string) {
    return this.enrollment.findEligibleRecipient(actor, email);
  }

  @Get('progress')
  @Roles(UserRole.MEMBER)
  progress(@CurrentUser() actor: AuthenticatedUser) {
    return this.enrollment.progress(actor);
  }

  @Get('eligible/:memberCode')
  @Roles(UserRole.MEMBER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  eligible(@CurrentUser() actor: AuthenticatedUser, @Param('memberCode') memberCode: string) {
    return this.enrollment.eligible(actor, memberCode);
  }

  @Post('preflight')
  @Roles(UserRole.MEMBER)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  preflight(@CurrentUser() actor: AuthenticatedUser, @Body() dto: EnrollExistingMemberDto) {
    return this.enrollment.preflight(actor, dto);
  }

  @Get('packages')
  @Roles(...STAFF)
  packages(@CurrentUser() user: AuthenticatedUser) { return this.enrollment.packages(user); }

  @Post('packages')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createPackage(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMemberPackageDto) {
    return this.enrollment.createPackage(user, dto);
  }

  @Post('packages/:id/approve')
  @Roles(UserRole.SUPER_ADMIN)
  approvePackage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalReferenceDto) {
    return this.enrollment.approvePackage(user, id, dto.approvalReference);
  }

  @Get('consents')
  @Roles(...STAFF)
  listConsents(@CurrentUser() actor: AuthenticatedUser) {
    return this.enrollment.listConsents(actor);
  }

  @Post('consents')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  createConsent(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMemberConsentDto) {
    return this.enrollment.createConsent(user, dto);
  }

  @Post('consents/:id/approve')
  @Roles(UserRole.SUPER_ADMIN)
  approveConsent(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ApprovalReferenceDto) {
    return this.enrollment.approveConsent(user, id, dto.approvalReference);
  }

  @Get('consents/current')
  @Roles(...STAFF, UserRole.MEMBER)
  currentConsent(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollment.currentConsent(user);
  }

  @Get('pins')
  @Roles(...STAFF)
  pins(@CurrentUser() user: AuthenticatedUser, @Query() query: MemberListQueryDto) {
    return this.enrollment.listPins(user, query.take, query.skip);
  }

  @Post('pins')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  issuePin(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueEnrollmentPinDto) {
    return this.enrollment.issuePin(user, dto);
  }

  @Post('pins/:id/revoke')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  revokePin(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RevokeEnrollmentPinDto) {
    return this.enrollment.revokePin(user, id, dto.reason);
  }

  @Post('enroll')
  @Roles(UserRole.MEMBER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  enroll(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnrollExistingMemberDto) {
    return this.enrollment.enrollExistingMember(user, dto);
  }
}
