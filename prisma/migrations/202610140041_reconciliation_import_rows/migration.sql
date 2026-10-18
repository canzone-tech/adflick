-- Batch 41: durable row-level reconciliation outcomes.
CREATE TABLE `ReconciliationImportRow` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `importId` VARCHAR(30) NOT NULL,
  `rowNumber` INT NOT NULL,
  `providerReference` VARCHAR(180) NOT NULL,
  `payoutReference` VARCHAR(180) NOT NULL,
  `amountPaise` INT NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `statementStatus` VARCHAR(30) NOT NULL,
  `outcome` VARCHAR(40) NOT NULL,
  `detail` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ReconciliationImportRow_importId_rowNumber_key` (`importId`,`rowNumber`),
  KEY `ReconciliationImportRow_org_import_outcome_idx` (`organizationId`,`importId`,`outcome`),
  KEY `ReconciliationImportRow_org_payout_idx` (`organizationId`,`payoutReference`),
  CONSTRAINT `ReconciliationImportRow_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ReconciliationImportRow_importId_fkey` FOREIGN KEY (`importId`) REFERENCES `ReconciliationImport` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
