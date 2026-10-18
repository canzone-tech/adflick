-- Batch 39: durable reconciliation import idempotency for MySQL 8.4.
CREATE TABLE `ReconciliationImport` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `providerName` VARCHAR(100) NOT NULL,
  `idempotencyKey` VARCHAR(180) NOT NULL,
  `payloadSha256` CHAR(64) NOT NULL,
  `status` ENUM('RECEIVED','PROCESSING','COMPLETED','FAILED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
  `rowCount` INT NOT NULL DEFAULT 0,
  `matchedCount` INT NOT NULL DEFAULT 0,
  `discrepancyCount` INT NOT NULL DEFAULT 0,
  `lastErrorCode` VARCHAR(100) NULL,
  `createdById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ReconciliationImport_org_provider_idempotencyKey_key` (`organizationId`,`providerName`,`idempotencyKey`),
  KEY `ReconciliationImport_org_status_createdAt_idx` (`organizationId`,`status`,`createdAt`),
  KEY `ReconciliationImport_payloadSha256_idx` (`payloadSha256`),
  CONSTRAINT `ReconciliationImport_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ReconciliationImport_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
