-- ADFLICK SRS phone OTP ownership proof. NO default provider, no phone activation.
-- Additive migration; production operator approval required separately.
CREATE TABLE `MemberPhoneOtp` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `phoneCiphertext` VARCHAR(256) NOT NULL,
  `phoneHash` CHAR(64) NOT NULL,
  `phoneLast4` CHAR(4) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `status` ENUM('QUEUED','SENT','VERIFIED','CONSUMED','FAILED') NOT NULL DEFAULT 'QUEUED',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL DEFAULT 5,
  `expiresAt` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NULL,
  `verifiedAt` DATETIME(3) NULL,
  `consumedAt` DATETIME(3) NULL,
  `smsConsentAcceptedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MemberPhoneOtp_org_user_created_idx`(`organizationId`, `userId`, `createdAt`),
  INDEX `MemberPhoneOtp_org_phone_created_idx`(`organizationId`, `phoneHash`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MemberPhoneOtp_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MemberPhoneOtp_userId_organizationId_fkey` FOREIGN KEY (`userId`, `organizationId`)
    REFERENCES `User`(`id`, `organizationId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MemberPhoneOtpThrottle` (
  `organizationId` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `nextAllowedAt` DATETIME(3) NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `requestCount` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`organizationId`,`userId`),
  UNIQUE INDEX `MemberPhoneOtpThrottle_userId_orgId_key`(`userId`,`organizationId`),
  CONSTRAINT `MemberPhoneOtpThrottle_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MemberPhoneOtpThrottle_userId_orgId_fkey` FOREIGN KEY (`userId`,`organizationId`)
    REFERENCES `User`(`id`,`organizationId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VerifiedMemberPhone` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `memberId` VARCHAR(30) NOT NULL,
  `challengeId` VARCHAR(30) NOT NULL,
  `phoneCiphertext` VARCHAR(256) NOT NULL,
  `phoneHash` CHAR(64) NOT NULL,
  `phoneLast4` CHAR(4) NOT NULL,
  `verifiedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VerifiedMemberPhone_userId_key`(`userId`),
  UNIQUE INDEX `VerifiedMemberPhone_memberId_key`(`memberId`),
  UNIQUE INDEX `VerifiedMemberPhone_challengeId_key`(`challengeId`),
  UNIQUE INDEX `VerifiedMemberPhone_userId_organizationId_key`(`userId`,`organizationId`),
  UNIQUE INDEX `VerifiedMemberPhone_organizationId_memberId_key`(`organizationId`,`memberId`),
  INDEX `VerifiedMemberPhone_organizationId_phoneHash_idx`(`organizationId`,`phoneHash`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VerifiedMemberPhone_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `VerifiedMemberPhone_userId_organizationId_fkey` FOREIGN KEY (`userId`,`organizationId`)
    REFERENCES `User`(`id`,`organizationId`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `VerifiedMemberPhone_org_member_fkey` FOREIGN KEY (`organizationId`,`memberId`)
    REFERENCES `MemberProfile`(`organizationId`,`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `VerifiedMemberPhone_challengeId_fkey` FOREIGN KEY (`challengeId`)
    REFERENCES `MemberPhoneOtp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
