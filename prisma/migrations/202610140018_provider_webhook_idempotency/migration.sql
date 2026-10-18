-- Batch 18: durable provider event registry. Secrets and raw PII payloads are not stored.
CREATE TABLE `ProviderWebhookEvent` (
  `id` VARCHAR(30) NOT NULL,
  `providerName` VARCHAR(100) NOT NULL,
  `providerEventId` VARCHAR(180) NOT NULL,
  `payloadSha256` CHAR(64) NOT NULL,
  `status` ENUM('RECEIVED','PROCESSING','PROCESSED','FAILED','IGNORED') NOT NULL DEFAULT 'RECEIVED',
  `attemptCount` INT NOT NULL DEFAULT 0,
  `lastErrorCode` VARCHAR(100) NULL,
  `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processedAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ProviderWebhookEvent_providerName_providerEventId_key` (`providerName`,`providerEventId`),
  KEY `ProviderWebhookEvent_status_receivedAt_idx` (`status`,`receivedAt`),
  KEY `ProviderWebhookEvent_payloadSha256_idx` (`payloadSha256`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
