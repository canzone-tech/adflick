CREATE TABLE `ScreenPlaylistAssignment` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `screenId` VARCHAR(30) NOT NULL,
  `playlistId` VARCHAR(30) NOT NULL,
  `priority` INTEGER NOT NULL DEFAULT 100,
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `assignedById` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ScreenPlaylistAssignment_org_screen_enabled_window_idx` (`organizationId`,`screenId`,`isEnabled`,`startsAt`,`endsAt`),
  INDEX `ScreenPlaylistAssignment_playlistId_isEnabled_idx` (`playlistId`,`isEnabled`),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ScreenPlaylistAssignment_screenId_playlistId_key` (`screenId`,`playlistId`),
  CONSTRAINT `ScreenPlaylistAssignment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ScreenPlaylistAssignment_screenId_fkey` FOREIGN KEY (`screenId`) REFERENCES `Screen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ScreenPlaylistAssignment_playlistId_fkey` FOREIGN KEY (`playlistId`) REFERENCES `Playlist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE INDEX `Campaign_status_startsAt_endsAt_idx` ON `Campaign` (`status`, `startsAt`, `endsAt`);
