CREATE TABLE `ScreenLayout` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `createdById` VARCHAR(30) NULL,
  `name` VARCHAR(180) NOT NULL,
  `description` VARCHAR(500) NULL,
  `canvasWidth` INTEGER NOT NULL DEFAULT 1920,
  `canvasHeight` INTEGER NOT NULL DEFAULT 1080,
  `status` ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `version` INTEGER NOT NULL DEFAULT 1,
  `zonesJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ScreenLayout_organizationId_status_updatedAt_idx`(`organizationId`, `status`, `updatedAt`),
  INDEX `ScreenLayout_createdById_updatedAt_idx`(`createdById`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ScreenLayout_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ScreenLayout_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `Playlist` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `createdById` VARCHAR(30) NULL,
  `name` VARCHAR(180) NOT NULL,
  `description` VARCHAR(500) NULL,
  `status` ENUM('DRAFT','ACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `itemsJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Playlist_organizationId_status_updatedAt_idx`(`organizationId`, `status`, `updatedAt`),
  INDEX `Playlist_createdById_updatedAt_idx`(`createdById`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Playlist_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Playlist_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `MediaAssetVersion` (
  `id` VARCHAR(30) NOT NULL,
  `mediaAssetId` VARCHAR(30) NOT NULL,
  `version` INTEGER NOT NULL,
  `storageKey` VARCHAR(512) NOT NULL,
  `checksumSha256` CHAR(64) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `sizeBytes` BIGINT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MediaAssetVersion_mediaAssetId_version_key`(`mediaAssetId`, `version`),
  INDEX `MediaAssetVersion_checksumSha256_idx`(`checksumSha256`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MediaAssetVersion_mediaAssetId_fkey` FOREIGN KEY (`mediaAssetId`) REFERENCES `MediaAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE INDEX `MediaAsset_status_mimeType_idx` ON `MediaAsset` (`status`, `mimeType`);
