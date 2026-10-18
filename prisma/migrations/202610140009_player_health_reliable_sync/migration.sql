ALTER TABLE `Screen`
  ADD COLUMN `cpuPercent` INTEGER NULL,
  ADD COLUMN `memoryPercent` INTEGER NULL,
  ADD COLUMN `storagePercent` INTEGER NULL,
  ADD COLUMN `capabilitiesJson` JSON NULL,
  ADD COLUMN `lastSyncAt` DATETIME(3) NULL,
  ADD COLUMN `lastPlayerError` VARCHAR(500) NULL;

ALTER TABLE `DeviceCommand`
  ADD COLUMN `deliveryCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastDeliveredAt` DATETIME(3) NULL,
  ADD COLUMN `lastError` VARCHAR(500) NULL;

CREATE INDEX `Screen_status_lastHeartbeatAt_idx` ON `Screen` (`status`,`lastHeartbeatAt`);
CREATE INDEX `DeviceCommand_status_expiresAt_lastDeliveredAt_idx` ON `DeviceCommand` (`status`,`expiresAt`,`lastDeliveredAt`);
