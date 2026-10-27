-- ADFLICK SRS v1.0: non-financial e-PIN and consent persistence.
-- Additive MySQL 8.4 migration. No real package pricing, paid enrollment,
-- earning policy or payout authorization. Production requires separate approval.

CREATE TABLE `MemberPackage` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `status` ENUM('DRAFT','ENABLED','DISABLED') NOT NULL DEFAULT 'DRAFT',
  `createdByUserId` VARCHAR(30) NOT NULL,
  `approvedByUserId` VARCHAR(30) NULL,
  `approvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MemberPackage_organizationId_id_key`(`organizationId`,`id`),
  UNIQUE INDEX `MemberPackage_organizationId_code_key`(`organizationId`,`code`),
  INDEX `MemberPackage_organizationId_status_idx`(`organizationId`,`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MemberPackage_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MemberConsentDocument` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `version` VARCHAR(60) NOT NULL,
  `documentSha256` CHAR(64) NOT NULL,
  `documentText` LONGTEXT NOT NULL,
  `status` ENUM('DRAFT','APPROVED','RETIRED') NOT NULL DEFAULT 'DRAFT',
  `createdByUserId` VARCHAR(30) NOT NULL,
  `approvedByUserId` VARCHAR(30) NULL,
  `approvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MemberConsentDocument_organizationId_id_key`(`organizationId`,`id`),
  UNIQUE INDEX `MemberConsentDocument_organizationId_version_key`(`organizationId`,`version`),
  INDEX `MemberConsentDocument_organizationId_status_idx`(`organizationId`,`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MemberConsentDocument_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EnrollmentPin` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `packageId` VARCHAR(30) NOT NULL,
  `recipientUserId` VARCHAR(30) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `status` ENUM('ISSUED','REDEEMED','REVOKED') NOT NULL DEFAULT 'ISSUED',
  `expiresAt` DATETIME(3) NOT NULL,
  `redeemedAt` DATETIME(3) NULL,
  `redeemedByMemberId` VARCHAR(30) NULL,
  `revokedAt` DATETIME(3) NULL,
  `issuedByUserId` VARCHAR(30) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `EnrollmentPin_tokenHash_key`(`tokenHash`),
  UNIQUE INDEX `EnrollmentPin_redeemedByMemberId_key`(`redeemedByMemberId`),
  UNIQUE INDEX `EnrollmentPin_organizationId_redeemedByMemberId_key`(`organizationId`,`redeemedByMemberId`),
  INDEX `EnrollmentPin_recipient_status_exp_idx`(`organizationId`,`recipientUserId`,`status`,`expiresAt`),
  INDEX `EnrollmentPin_organizationId_status_createdAt_idx`(`organizationId`,`status`,`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `EnrollmentPin_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EnrollmentPin_organizationId_packageId_fkey`
    FOREIGN KEY (`organizationId`,`packageId`) REFERENCES `MemberPackage`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EnrollmentPin_recipientUserId_organizationId_fkey`
    FOREIGN KEY (`recipientUserId`,`organizationId`) REFERENCES `User`(`id`,`organizationId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `EnrollmentPin_organizationId_redeemedByMemberId_fkey`
    FOREIGN KEY (`organizationId`,`redeemedByMemberId`) REFERENCES `MemberProfile`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MemberConsentRecord` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `memberId` VARCHAR(30) NOT NULL,
  `documentId` VARCHAR(30) NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MemberConsentRecord_memberId_key`(`memberId`),
  UNIQUE INDEX `MemberConsentRecord_organizationId_memberId_key`(`organizationId`,`memberId`),
  INDEX `MemberConsentRecord_organizationId_documentId_acceptedAt_idx`(`organizationId`,`documentId`,`acceptedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MemberConsentRecord_organizationId_fkey` FOREIGN KEY (`organizationId`)
    REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MemberConsentRecord_organizationId_memberId_fkey`
    FOREIGN KEY (`organizationId`,`memberId`) REFERENCES `MemberProfile`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MemberConsentRecord_organizationId_documentId_fkey`
    FOREIGN KEY (`organizationId`,`documentId`) REFERENCES `MemberConsentDocument`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
