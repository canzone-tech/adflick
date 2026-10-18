ALTER TABLE `Screen`
  MODIFY `status` ENUM('PENDING_PAIRING','ONLINE','OFFLINE','MAINTENANCE','SUSPENDED','RETIRED') NOT NULL DEFAULT 'PENDING_PAIRING',
  ADD COLUMN `deviceKeyHash` CHAR(64) NULL,
  ADD COLUMN `devicePlatform` VARCHAR(80) NULL,
  ADD COLUMN `playerVersion` VARCHAR(40) NULL,
  ADD COLUMN `lastHeartbeatAt` DATETIME(3) NULL,
  ADD COLUMN `lastIpAddress` VARCHAR(45) NULL,
  ADD UNIQUE INDEX `Screen_deviceKeyHash_key` (`deviceKeyHash`),
  ADD INDEX `Screen_lastHeartbeatAt_idx` (`lastHeartbeatAt`);

CREATE TABLE `DevicePairingCode` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `screenId` VARCHAR(30) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `status` ENUM('ACTIVE','CONSUMED','EXPIRED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `DevicePairingCode_codeHash_key` (`codeHash`),
  INDEX `DevicePairingCode_organizationId_status_expiresAt_idx` (`organizationId`,`status`,`expiresAt`),
  INDEX `DevicePairingCode_screenId_status_idx` (`screenId`,`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `DevicePairingCode_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DevicePairingCode_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `DeviceCommand` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `screenId` VARCHAR(30) NOT NULL,
  `type` ENUM('REFRESH_PLAYLIST','RESTART_PLAYER','RELOAD_APP','SET_VOLUME','TAKE_SCREENSHOT','SYNC_TIME') NOT NULL,
  `payloadJson` JSON NULL,
  `status` ENUM('PENDING','ACKNOWLEDGED','FAILED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  `requestedById` VARCHAR(30) NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `acknowledgedAt` DATETIME(3) NULL,
  `resultJson` JSON NULL,
  INDEX `DeviceCommand_organizationId_status_requestedAt_idx` (`organizationId`,`status`,`requestedAt`),
  INDEX `DeviceCommand_screenId_status_expiresAt_idx` (`screenId`,`status`,`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `DeviceCommand_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `DeviceCommand_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
