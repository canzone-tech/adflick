-- Batch 102 canonical reconciliation: durable playback transaction outbox.
-- PlaybackEvent remains the authoritative evidence row; this table stores downstream work only.
CREATE TABLE `PlaybackOutbox` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `screenId` VARCHAR(30) NOT NULL,
  `playbackEventId` VARCHAR(30) NOT NULL,
  `eventId` VARCHAR(100) NOT NULL,
  `topic` VARCHAR(100) NOT NULL,
  `payload` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `publishedAt` DATETIME(3) NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `lastError` VARCHAR(1000) NULL,
  UNIQUE INDEX `PlaybackOutbox_playbackEventId_topic_key` (`playbackEventId`, `topic`),
  INDEX `PlaybackOutbox_publishedAt_createdAt_idx` (`publishedAt`, `createdAt`),
  INDEX `PlaybackOutbox_organizationId_createdAt_idx` (`organizationId`, `createdAt`),
  INDEX `PlaybackOutbox_screenId_createdAt_idx` (`screenId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
