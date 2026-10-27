-- ADFLICK SRS v1.0: public email-verified account bootstrap.
-- No member placement, e-PIN claim, mobile OTP, activation or compensation.
-- Operator must separately authorize production migrations and enablement.

CREATE TABLE `PublicSignupPolicy` (
  `organizationId` VARCHAR(30) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updatedByUserId` VARCHAR(30) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`organizationId`),
  CONSTRAINT `PublicSignupPolicy_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PublicSignupIntent` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `emailHash` CHAR(64) NOT NULL,
  `displayName` VARCHAR(160) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `consentDocumentId` VARCHAR(30) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `status` ENUM('QUEUED','SENT','CONSUMED','FAILED') NOT NULL DEFAULT 'QUEUED',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `maxAttempts` INTEGER NOT NULL DEFAULT 5,
  `expiresAt` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NULL,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SignupIntent_org_email_status_idx`(`organizationId`,`emailHash`,`status`),
  INDEX `PublicSignupIntent_organizationId_expiresAt_idx`(`organizationId`,`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PublicSignupIntent_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PublicSignupIntent_org_consent_fkey`
    FOREIGN KEY (`organizationId`,`consentDocumentId`)
    REFERENCES `MemberConsentDocument`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PublicSignupThrottle` (
  `organizationId` VARCHAR(30) NOT NULL,
  `emailHash` CHAR(64) NOT NULL,
  `nextAllowedAt` DATETIME(3) NOT NULL,
  `windowStart` DATETIME(3) NOT NULL,
  `requestCount` INTEGER NOT NULL DEFAULT 1,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`organizationId`,`emailHash`),
  CONSTRAINT `PublicSignupThrottle_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountConsentRecord` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `documentId` VARCHAR(30) NOT NULL,
  `acceptedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `AccountConsentRecord_userId_key`(`userId`),
  UNIQUE INDEX `AccountConsentRecord_organizationId_userId_key`(`organizationId`,`userId`),
  INDEX `AccountConsentRecord_organizationId_documentId_idx`(`organizationId`,`documentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AccountConsentRecord_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AccountConsentRecord_userId_organizationId_fkey`
    FOREIGN KEY (`userId`,`organizationId`) REFERENCES `User`(`id`,`organizationId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `AccountConsentRecord_org_document_fkey`
    FOREIGN KEY (`organizationId`,`documentId`) REFERENCES `MemberConsentDocument`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
