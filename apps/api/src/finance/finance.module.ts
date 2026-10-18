import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { ReconciliationImportService } from './reconciliation/reconciliation-import.service';
import { PrismaReconciliationImportStore } from './reconciliation/prisma-reconciliation-import-store';
@Module({ controllers: [FinanceController], providers: [FinanceService, ReconciliationImportService, PrismaReconciliationImportStore] })
export class FinanceModule {}
