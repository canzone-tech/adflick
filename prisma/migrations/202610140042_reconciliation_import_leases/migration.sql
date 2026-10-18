-- Batch 42: lease-based single-worker claims and safe stale import recovery.
ALTER TABLE `ReconciliationImport`
  ADD COLUMN `processingToken` VARCHAR(36) NULL,
  ADD COLUMN `processingLeaseUntil` DATETIME(3) NULL,
  ADD COLUMN `attemptCount` INT NOT NULL DEFAULT 0,
  ADD KEY `ReconciliationImport_status_lease_idx` (`status`, `processingLeaseUntil`);
