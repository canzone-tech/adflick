import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MembersService } from './members.service';
import { MemberListQueryDto, MemberTreeQueryDto } from './members.dto';

const STAFF_ROLES = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.AUDITOR_COMPLIANCE];

@Controller('members')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @Roles(...STAFF_ROLES)
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: MemberListQueryDto) {
    return this.members.list(actor, query);
  }

  @Get('me')
  @Roles(UserRole.MEMBER)
  myProfile(@CurrentUser() actor: AuthenticatedUser) {
    return this.members.myProfile(actor);
  }

  @Get('me/tree')
  @Roles(UserRole.MEMBER)
  myTree(@CurrentUser() actor: AuthenticatedUser, @Query() query: MemberTreeQueryDto) {
    return this.members.myTree(actor, query.depth);
  }

  @Get(':memberCode')
  @Roles(...STAFF_ROLES)
  detail(@CurrentUser() actor: AuthenticatedUser, @Param('memberCode') memberCode: string) {
    return this.members.detail(actor, memberCode);
  }

  @Get(':memberCode/tree')
  @Roles(...STAFF_ROLES)
  tree(@CurrentUser() actor: AuthenticatedUser, @Param('memberCode') memberCode: string, @Query() query: MemberTreeQueryDto) {
    return this.members.tree(actor, memberCode, query.depth);
  }
}
