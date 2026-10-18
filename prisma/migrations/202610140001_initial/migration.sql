CREATE TABLE `Organization` (
  `id` VARCHAR(30) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Organization_slug_key`(`slug`),
  INDEX `Organization_isActive_createdAt_idx`(`isActive`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `User` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NULL,
  `email` VARCHAR(254) NOT NULL,
  `displayName` VARCHAR(160) NOT NULL,
  `status` ENUM('INVITED','ACTIVE','SUSPENDED','DEACTIVATED') NOT NULL DEFAULT 'INVITED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_email_key`(`email`),
  INDEX `User_organizationId_status_idx`(`organizationId`, `status`),
  INDEX `User_displayName_idx`(`displayName`),
  PRIMARY KEY (`id`),
  CONSTRAINT `User_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `UserRoleAssignment` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `role` ENUM('SUPER_ADMIN','ORGANIZATION_ADMIN','ADVERTISER','SCREEN_OWNER','CONTENT_MANAGER','OPERATIONS_MANAGER','FINANCE_MANAGER','SUPPORT_AGENT','AUDITOR_COMPLIANCE') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `UserRoleAssignment_userId_role_key`(`userId`, `role`),
  INDEX `UserRoleAssignment_role_createdAt_idx`(`role`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `UserRoleAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `Screen` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `ownerUserId` VARCHAR(30) NULL,
  `name` VARCHAR(160) NOT NULL,
  `externalCode` VARCHAR(80) NULL,
  `platform` VARCHAR(60) NOT NULL,
  `status` ENUM('PENDING_PAIRING','ONLINE','OFFLINE','MAINTENANCE','SUSPENDED') NOT NULL DEFAULT 'PENDING_PAIRING',
  `timezone` VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
  `lastSeenAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Screen_externalCode_key`(`externalCode`),
  INDEX `Screen_organizationId_status_idx`(`organizationId`, `status`),
  INDEX `Screen_ownerUserId_status_idx`(`ownerUserId`, `status`),
  INDEX `Screen_lastSeenAt_idx`(`lastSeenAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Screen_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Screen_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `MediaAsset` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `uploadedById` VARCHAR(30) NULL,
  `title` VARCHAR(180) NOT NULL,
  `originalName` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(120) NOT NULL,
  `sizeBytes` BIGINT NOT NULL,
  `checksumSha256` CHAR(64) NULL,
  `storageKey` VARCHAR(512) NULL,
  `status` ENUM('UPLOADING','PROCESSING','READY','REJECTED','ARCHIVED') NOT NULL DEFAULT 'UPLOADING',
  `durationMs` INTEGER NULL,
  `width` INTEGER NULL,
  `height` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `MediaAsset_organizationId_status_createdAt_idx`(`organizationId`, `status`, `createdAt`),
  INDEX `MediaAsset_uploadedById_createdAt_idx`(`uploadedById`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MediaAsset_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MediaAsset_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `Campaign` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `status` ENUM('DRAFT','PENDING_REVIEW','APPROVED','SCHEDULED','ACTIVE','PAUSED','COMPLETED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `budgetPaise` BIGINT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'INR',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Campaign_organizationId_status_startsAt_idx`(`organizationId`, `status`, `startsAt`),
  INDEX `Campaign_endsAt_idx`(`endsAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Campaign_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `AuditEvent` (
  `id` VARCHAR(30) NOT NULL,
  `actorUserId` VARCHAR(30) NULL,
  `organizationId` VARCHAR(30) NULL,
  `action` VARCHAR(120) NOT NULL,
  `entityType` VARCHAR(80) NOT NULL,
  `entityId` VARCHAR(80) NULL,
  `severity` ENUM('INFO','WARNING','CRITICAL') NOT NULL DEFAULT 'INFO',
  `metadataJson` JSON NULL,
  `ipAddress` VARCHAR(45) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuditEvent_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
  INDEX `AuditEvent_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  INDEX `AuditEvent_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
  INDEX `AuditEvent_severity_createdAt_idx`(`severity`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AuditEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
