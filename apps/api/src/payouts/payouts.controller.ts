import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PayoutsService } from './payouts.service';
import { CreatePayoutBatchDto } from './dto/create-payout-batch.dto';
import { PayoutDecisionDto } from './dto/payout-decision.dto';
import { SubmitPayoutDto } from './dto/submit-payout.dto';
import { ReconcilePayoutDto } from './dto/reconcile-payout.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
const READ = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER, UserRole.AUDITOR_COMPLIANCE];
const WRITE = [UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN, UserRole.FINANCE_MANAGER];
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}
  @Get('payout-batches') @Roles(...READ) list(@CurrentUser() actor: AuthenticatedUser) { return this.payouts.listBatches(actor); }
  @Post('payout-batches') @Roles(...WRITE) create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreatePayoutBatchDto) { return this.payouts.createBatch(actor, dto); }
  @Post('payout-batches/:id/request-approval') @Roles(...WRITE) request(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.payouts.requestApproval(actor, id); }
  @Post('payout-batches/:id/decision') @Roles(...WRITE) decide(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: PayoutDecisionDto) { return this.payouts.decide(actor, id, dto); }
  @Post('payout-batches/:id/export') @Roles(...WRITE) export(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.payouts.exportBatch(actor, id); }
  @Post('payout-batches/:id/submit') @Roles(...WRITE) submit(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: SubmitPayoutDto) { return this.payouts.submitToProvider(actor, id, dto); }
  @Post('payout-batches/:id/reconcile') @Roles(...WRITE) reconcile(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReconcilePayoutDto) { return this.payouts.reconcile(actor, id, dto); }
  @Get('disputes') @Roles(...READ) disputes(@CurrentUser() actor: AuthenticatedUser) { return this.payouts.listDisputes(actor); }
  @Post('disputes') @Roles(...WRITE) openDispute(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateDisputeDto) { return this.payouts.createDispute(actor, dto); }
  @Post('disputes/:id/resolve') @Roles(...WRITE) resolve(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ResolveDisputeDto) { return this.payouts.resolveDispute(actor, id, dto); }
}
