-- ADFLICK SRS v1.0 configurable email OTP for pending member enrollment.
-- Isolated additive migration. Sending disabled until explicit approved configuration.
-- SMTP secrets are never persisted to MySQL.

CREATE TABLE `MemberOtpPolicy` (
  `organizationId` VARCHAR(30) NOT NULL,
  `emailEnabled` BOOLEAN NOT NULL DEFAULT false,
  `digits` INTEGER NOT NULL DEFAULT 6,
  `ttlSeconds` INTEGER NOT NULL DEFAULT 300,
  `resendSeconds` INTEGER NOT NULL DEFAULT 60,
  `maxAttempts` INTEGER NOT NULL DEFAULT 5,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedByUserId` VARCHAR(30) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`organizationId`),
  CONSTRAINT `MemberOtpPolicy_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MemberEmailOtp` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `purpose` ENUM('MEMBER_ENROLLMENT') NOT NULL DEFAULT 'MEMBER_ENROLLMENT',
  `codeHash` CHAR(64) NOT NULL,
  `status` ENUM('QUEUED','SENT','VERIFIED','CONSUMED','FAILED') NOT NULL DEFAULT 'QUEUED',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NULL,
  `verifiedAt` DATETIME(3) NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MemberEmailOtp_owner_purpose_created_idx`(`organizationId`,`userId`,`purpose`,`createdAt`),
  INDEX `MemberEmailOtp_organizationId_status_expiresAt_idx`(`organizationId`,`status`,`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MemberEmailOtp_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MemberEmailOtp_userId_organizationId_fkey` FOREIGN KEY (`userId`,`organizationId`)
    REFERENCES `User`(`id`,`organizationId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MemberEmailOtpThrottle` (
  `organizationId` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `purpose` ENUM('MEMBER_ENROLLMENT') NOT NULL DEFAULT 'MEMBER_ENROLLMENT',
  `nextAllowedAt` DATETIME(3) NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `requestCount` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`organizationId`,`userId`,`purpose`),
  CONSTRAINT `MemberEmailOtpThrottle_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MemberEmailOtpThrottle_userId_orgId_fkey` FOREIGN KEY (`userId`,`organizationId`)
    REFERENCES `User`(`id`,`organizationId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
