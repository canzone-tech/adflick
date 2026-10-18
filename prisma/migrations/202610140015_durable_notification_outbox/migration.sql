-- BATCH 15: durable, retryable notification outbox (MySQL 8.4)
CREATE TABLE `NotificationOutbox` (
  `id` VARCHAR(30) NOT NULL,
  `eventKey` VARCHAR(180) NOT NULL,
  `eventType` VARCHAR(100) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('PENDING','PROCESSING','DELIVERED','FAILED') NOT NULL DEFAULT 'PENDING',
  `attempts` INT NOT NULL DEFAULT 0,
  `maxAttempts` INT NOT NULL DEFAULT 8,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lockedAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `lastError` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `NotificationOutbox_eventKey_key` (`eventKey`),
  INDEX `NotificationOutbox_status_availableAt_createdAt_idx` (`status`, `availableAt`, `createdAt`),
  INDEX `NotificationOutbox_organizationId_createdAt_idx` (`organizationId`, `createdAt`),
  INDEX `NotificationOutbox_status_lockedAt_idx` (`status`, `lockedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `NotificationOutbox_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
