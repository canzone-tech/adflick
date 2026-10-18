CREATE TABLE `PlaybackAuthorization` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `screenId` VARCHAR(30) NOT NULL,
  `assetId` VARCHAR(30) NOT NULL,
  `campaignId` VARCHAR(30) NULL,
  `playlistId` VARCHAR(30) NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `consumedAt` DATETIME(3) NULL,
  INDEX `PlaybackAuthorization_screenId_expiresAt_idx` (`screenId`,`expiresAt`),
  INDEX `PlaybackAuthorization_campaignId_screenId_idx` (`campaignId`,`screenId`),
  INDEX `PlaybackAuthorization_assetId_expiresAt_idx` (`assetId`,`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PlaybackAuthorization_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PlaybackAuthorization_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PlaybackAuthorization_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `MediaAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PlaybackAuthorization_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `PlaybackEvent`
  ADD COLUMN `authorizationId` VARCHAR(30) NULL,
  ADD INDEX `PlaybackEvent_authorizationId_idx` (`authorizationId`),
  ADD CONSTRAINT `PlaybackEvent_authorizationId_fkey`
    FOREIGN KEY (`authorizationId`) REFERENCES `PlaybackAuthorization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
