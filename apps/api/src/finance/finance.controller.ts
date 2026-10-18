import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FinanceService } from './finance.service';
import { UpsertRewardPolicyDto } from './dto/upsert-reward-policy.dto';
import { CalculateRewardsDto } from './dto/calculate-rewards.dto';
import { DecisionDto } from './dto/decision.dto';
import { ReserveReconciliationImportDto } from './dto/reserve-reconciliation-import.dto';
import { ReconciliationImportService } from './reconciliation/reconciliation-import.service';

const FINANCE_READ = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR_COMPLIANCE];
const FINANCE_WRITE = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER];
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService, private readonly reconciliationImports: ReconciliationImportService) {}
  @Get('reward-policy') @Roles(...FINANCE_READ)
  policy(@CurrentUser() actor: AuthenticatedUser) { return this.finance.getPolicy(actor); }
  @Patch('reward-policy') @Roles(...FINANCE_WRITE)
  updatePolicy(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpsertRewardPolicyDto) { return this.finance.upsertPolicy(actor, dto); }
  @Post('rewards/calculate') @Roles(...FINANCE_WRITE)
  calculate(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CalculateRewardsDto) { return this.finance.calculate(actor, dto); }
  @Get('rewards') @Roles(...FINANCE_READ)
  rewards(@CurrentUser() actor: AuthenticatedUser) { return this.finance.listRewards(actor); }
  @Post('rewards/:id/request-approval') @Roles(...FINANCE_WRITE)
  requestApproval(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.finance.requestApproval(actor, id); }
  @Get('approvals') @Roles(...FINANCE_READ)
  approvals(@CurrentUser() actor: AuthenticatedUser) { return this.finance.listApprovals(actor); }
  @Post('approvals/:id/decision') @Roles(...FINANCE_WRITE)
  decide(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: DecisionDto) { return this.finance.decide(actor, id, dto); }
  @Get('reconciliation-imports/:id') @Roles(...FINANCE_READ)
  getReconciliationImport(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.reconciliationImports.getImport(actor, id);
  }
  @Get('reconciliation-imports/:id/rows') @Roles(...FINANCE_READ)
  getReconciliationImportRows(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.reconciliationImports.getImportRows(actor, id, limit, offset);
  }
  @Post('reconciliation-imports/reserve') @Roles(...FINANCE_WRITE)
  reserveReconciliationImport(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ReserveReconciliationImportDto) {
    return this.reconciliationImports.reserve(actor, dto);
  }
  @Post('reconciliation-imports/process') @Roles(...FINANCE_WRITE)
  processReconciliationImport(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ReserveReconciliationImportDto) {
    return this.reconciliationImports.process(actor, dto);
  }
  @Get('ledger') @Roles(...FINANCE_READ)
  ledger(@CurrentUser() actor: AuthenticatedUser) { return this.finance.ledger(actor); }
}
