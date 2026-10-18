-- Batch 16: configurable eligibility, immutable ledger and maker-checker approvals (MySQL 8.4)
CREATE TABLE `RewardPolicy` (
  `id` VARCHAR(30) NOT NULL, `organizationId` VARCHAR(30) NOT NULL,
  `tvMonthlyAmountPaise` INTEGER NOT NULL DEFAULT 100000,
  `smartphoneMonthlyAmountPaise` INTEGER NOT NULL DEFAULT 33300,
  `tvMinimumValidPlays` INTEGER NOT NULL DEFAULT 1000,
  `smartphoneMinimumValidPlays` INTEGER NOT NULL DEFAULT 500,
  `minimumCampaignCoveragePercent` INTEGER NOT NULL DEFAULT 1,
  `minimumDeviceUptimePercent` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `RewardPolicy_organizationId_key` (`organizationId`),
  INDEX `RewardPolicy_enabled_effectiveFrom_idx` (`enabled`,`effectiveFrom`),
  CONSTRAINT `RewardPolicy_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RewardCalculation` (
  `id` VARCHAR(30) NOT NULL, `organizationId` VARCHAR(30) NOT NULL, `screenId` VARCHAR(30) NOT NULL,
  `ownerUserId` VARCHAR(30) NULL, `periodStart` DATETIME(3) NOT NULL, `periodEnd` DATETIME(3) NOT NULL,
  `deviceType` ENUM('TV','SMARTPHONE') NOT NULL, `validCompletedPlays` INTEGER NOT NULL DEFAULT 0,
  `requiredCompletedPlays` INTEGER NOT NULL, `campaignCoveragePercent` INTEGER NOT NULL DEFAULT 0,
  `amountPaise` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('ELIGIBLE','INELIGIBLE','PENDING_APPROVAL','APPROVED','REJECTED','ON_HOLD','REVERSED') NOT NULL DEFAULT 'INELIGIBLE',
  `reasonCode` VARCHAR(80) NOT NULL, `reasonDetail` VARCHAR(500) NOT NULL, `policySnapshotJson` JSON NOT NULL,
  `createdById` VARCHAR(30) NOT NULL, `approvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `RewardCalculation_screenId_periodStart_periodEnd_key` (`screenId`,`periodStart`,`periodEnd`),
  INDEX `RewardCalculation_organizationId_status_periodStart_idx` (`organizationId`,`status`,`periodStart`),
  INDEX `RewardCalculation_ownerUserId_periodStart_periodEnd_idx` (`ownerUserId`,`periodStart`,`periodEnd`),
  CONSTRAINT `RewardCalculation_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RewardCalculation_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RewardCalculation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RewardLedgerEntry` (
  `id` VARCHAR(30) NOT NULL, `organizationId` VARCHAR(30) NOT NULL, `rewardCalculationId` VARCHAR(30) NOT NULL,
  `entryType` ENUM('REWARD_ACCRUAL','REWARD_REVERSAL','MANUAL_ADJUSTMENT') NOT NULL,
  `amountPaise` INTEGER NOT NULL, `currency` CHAR(3) NOT NULL DEFAULT 'INR', `idempotencyKey` VARCHAR(160) NOT NULL,
  `description` VARCHAR(500) NOT NULL, `createdById` VARCHAR(30) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `RewardLedgerEntry_idempotencyKey_key` (`idempotencyKey`),
  INDEX `RewardLedgerEntry_organizationId_createdAt_idx` (`organizationId`,`createdAt`), INDEX `RewardLedgerEntry_rewardCalculationId_createdAt_idx` (`rewardCalculationId`,`createdAt`),
  CONSTRAINT `RewardLedgerEntry_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RewardLedgerEntry_rewardCalculationId_fkey` FOREIGN KEY (`rewardCalculationId`) REFERENCES `RewardCalculation` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FinanceApproval` (
  `id` VARCHAR(30) NOT NULL, `organizationId` VARCHAR(30) NOT NULL, `rewardCalculationId` VARCHAR(30) NOT NULL,
  `requestedById` VARCHAR(30) NOT NULL, `decidedById` VARCHAR(30) NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `decisionNote` VARCHAR(500) NULL, `requestKey` VARCHAR(160) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `decidedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `FinanceApproval_requestKey_key` (`requestKey`),
  INDEX `FinanceApproval_organizationId_status_createdAt_idx` (`organizationId`,`status`,`createdAt`), INDEX `FinanceApproval_rewardCalculationId_status_idx` (`rewardCalculationId`,`status`),
  CONSTRAINT `FinanceApproval_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `FinanceApproval_rewardCalculationId_fkey` FOREIGN KEY (`rewardCalculationId`) REFERENCES `RewardCalculation` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `FinanceApproval_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `FinanceApproval_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
