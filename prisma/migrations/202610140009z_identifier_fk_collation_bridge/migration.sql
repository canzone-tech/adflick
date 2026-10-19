-- ADFLICK pre-010 compatibility bridge. Append-only migration; DO NOT change historical checksums.
-- Scope: opaque VARCHAR(30) identifier/foreign-key columns only; leave names, slugs, emails and money rules unchanged.
-- Migration order: 001-009 -> 009z bridge -> 010-042. Production migration requires independent review/authorization.
-- Constraints are dropped and restored with original names and ON DELETE/ON UPDATE actions. No FK_CHECKS bypass.

-- Phase 1: detach existing FKs before changing the charset of both referenced and referencing ID fields.
ALTER TABLE `User`
  DROP FOREIGN KEY `User_organizationId_fkey`;
ALTER TABLE `UserRoleAssignment`
  DROP FOREIGN KEY `UserRoleAssignment_userId_fkey`;
ALTER TABLE `Screen`
  DROP FOREIGN KEY `Screen_organizationId_fkey`,
  DROP FOREIGN KEY `Screen_ownerUserId_fkey`;
ALTER TABLE `MediaAsset`
  DROP FOREIGN KEY `MediaAsset_organizationId_fkey`,
  DROP FOREIGN KEY `MediaAsset_uploadedById_fkey`;
ALTER TABLE `Campaign`
  DROP FOREIGN KEY `Campaign_organizationId_fkey`;
ALTER TABLE `AuditEvent`
  DROP FOREIGN KEY `AuditEvent_actorUserId_fkey`;
ALTER TABLE `RefreshSession`
  DROP FOREIGN KEY `RefreshSession_userId_fkey`;
ALTER TABLE `ScreenLayout`
  DROP FOREIGN KEY `ScreenLayout_organizationId_fkey`,
  DROP FOREIGN KEY `ScreenLayout_createdById_fkey`;
ALTER TABLE `Playlist`
  DROP FOREIGN KEY `Playlist_organizationId_fkey`,
  DROP FOREIGN KEY `Playlist_createdById_fkey`;
ALTER TABLE `MediaAssetVersion`
  DROP FOREIGN KEY `MediaAssetVersion_mediaAssetId_fkey`;
ALTER TABLE `DevicePairingCode`
  DROP FOREIGN KEY `DevicePairingCode_organizationId_fkey`,
  DROP FOREIGN KEY `DevicePairingCode_screenId_fkey`;
ALTER TABLE `DeviceCommand`
  DROP FOREIGN KEY `DeviceCommand_organizationId_fkey`,
  DROP FOREIGN KEY `DeviceCommand_screenId_fkey`;
ALTER TABLE `PlaybackEvent`
  DROP FOREIGN KEY `PlaybackEvent_screenId_fkey`,
  DROP FOREIGN KEY `PlaybackEvent_assetId_fkey`,
  DROP FOREIGN KEY `PlaybackEvent_campaignId_fkey`,
  DROP FOREIGN KEY `PlaybackEvent_playlistId_fkey`,
  DROP FOREIGN KEY `PlaybackEvent_organizationId_fkey`,
  DROP FOREIGN KEY `PlaybackEvent_authorizationId_fkey`;
ALTER TABLE `CampaignCreative`
  DROP FOREIGN KEY `CampaignCreative_campaignId_fkey`,
  DROP FOREIGN KEY `CampaignCreative_assetId_fkey`;
ALTER TABLE `CampaignScreenTarget`
  DROP FOREIGN KEY `CampaignScreenTarget_campaignId_fkey`,
  DROP FOREIGN KEY `CampaignScreenTarget_screenId_fkey`;
ALTER TABLE `PlaybackAuthorization`
  DROP FOREIGN KEY `PlaybackAuthorization_organizationId_fkey`,
  DROP FOREIGN KEY `PlaybackAuthorization_screenId_fkey`,
  DROP FOREIGN KEY `PlaybackAuthorization_assetId_fkey`,
  DROP FOREIGN KEY `PlaybackAuthorization_campaignId_fkey`;
ALTER TABLE `ScreenPlaylistAssignment`
  DROP FOREIGN KEY `ScreenPlaylistAssignment_organizationId_fkey`,
  DROP FOREIGN KEY `ScreenPlaylistAssignment_screenId_fkey`,
  DROP FOREIGN KEY `ScreenPlaylistAssignment_playlistId_fkey`;

-- Phase 2: align only opaque ID and FK columns with the collation used by later migrations.
ALTER TABLE `Organization`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `User`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `UserRoleAssignment`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `userId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `Screen`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `ownerUserId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `MediaAsset`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `uploadedById` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `Campaign`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `AuditEvent`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `actorUserId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `RefreshSession`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `userId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `ScreenLayout`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `createdById` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `Playlist`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `createdById` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `MediaAssetVersion`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `mediaAssetId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `DevicePairingCode`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `screenId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `DeviceCommand`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `screenId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `PlaybackEvent`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `screenId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `assetId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `campaignId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  MODIFY COLUMN `playlistId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `authorizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `CampaignCreative`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `campaignId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `assetId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `CampaignScreenTarget`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `campaignId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `screenId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE `PlaybackAuthorization`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `screenId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `assetId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `campaignId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `ScreenPlaylistAssignment`
  MODIFY COLUMN `id` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `organizationId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `screenId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  MODIFY COLUMN `playlistId` VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- Phase 3: restore all original constraints and delete/update semantics.
ALTER TABLE `User`
  ADD CONSTRAINT `User_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `UserRoleAssignment`
  ADD CONSTRAINT `UserRoleAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Screen`
  ADD CONSTRAINT `Screen_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Screen_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MediaAsset`
  ADD CONSTRAINT `MediaAsset_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `MediaAsset_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Campaign`
  ADD CONSTRAINT `Campaign_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuditEvent`
  ADD CONSTRAINT `AuditEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RefreshSession`
  ADD CONSTRAINT `RefreshSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ScreenLayout`
  ADD CONSTRAINT `ScreenLayout_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ScreenLayout_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Playlist`
  ADD CONSTRAINT `Playlist_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Playlist_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MediaAssetVersion`
  ADD CONSTRAINT `MediaAssetVersion_mediaAssetId_fkey` FOREIGN KEY (`mediaAssetId`) REFERENCES `MediaAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DevicePairingCode`
  ADD CONSTRAINT `DevicePairingCode_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `DevicePairingCode_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DeviceCommand`
  ADD CONSTRAINT `DeviceCommand_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `DeviceCommand_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlaybackEvent`
  ADD CONSTRAINT `PlaybackEvent_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PlaybackEvent_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `MediaAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PlaybackEvent_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PlaybackEvent_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `Playlist`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PlaybackEvent_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PlaybackEvent_authorizationId_fkey` FOREIGN KEY (`authorizationId`) REFERENCES `PlaybackAuthorization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CampaignCreative`
  ADD CONSTRAINT `CampaignCreative_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CampaignCreative_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `MediaAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CampaignScreenTarget`
  ADD CONSTRAINT `CampaignScreenTarget_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `CampaignScreenTarget_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlaybackAuthorization`
  ADD CONSTRAINT `PlaybackAuthorization_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PlaybackAuthorization_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `PlaybackAuthorization_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `MediaAsset`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PlaybackAuthorization_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ScreenPlaylistAssignment`
  ADD CONSTRAINT `ScreenPlaylistAssignment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ScreenPlaylistAssignment_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ScreenPlaylistAssignment_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `Playlist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
