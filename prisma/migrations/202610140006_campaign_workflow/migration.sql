ALTER TABLE `Campaign`
  ADD COLUMN `description` VARCHAR(1000) NULL,
  ADD COLUMN `submittedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewedById` VARCHAR(30) NULL,
  ADD COLUMN `reviewNote` VARCHAR(1000) NULL,
  ADD COLUMN `createdById` VARCHAR(30) NULL;

CREATE TABLE `CampaignCreative` (
  `id` VARCHAR(30) NOT NULL,
  `campaignId` VARCHAR(30) NOT NULL,
  `assetId` VARCHAR(30) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CampaignCreative_campaignId_assetId_key` (`campaignId`,`assetId`),
  INDEX `CampaignCreative_campaignId_sortOrder_idx` (`campaignId`,`sortOrder`),
  INDEX `CampaignCreative_assetId_idx` (`assetId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CampaignCreative_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CampaignCreative_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `MediaAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `CampaignScreenTarget` (
  `id` VARCHAR(30) NOT NULL,
  `campaignId` VARCHAR(30) NOT NULL,
  `screenId` VARCHAR(30) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CampaignScreenTarget_campaignId_screenId_key` (`campaignId`,`screenId`),
  INDEX `CampaignScreenTarget_screenId_campaignId_idx` (`screenId`,`campaignId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CampaignScreenTarget_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CampaignScreenTarget_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
