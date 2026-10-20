ALTER TABLE `RefreshSession`
  ADD COLUMN `mfaVerifiedAt` DATETIME(3) NULL;

CREATE TABLE `MfaEnrollment` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `secretCiphertext` VARCHAR(512) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `enrollmentExpiresAt` DATETIME(3) NULL,
  `lastAcceptedStep` BIGINT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MfaEnrollment_userId_key`(`userId`),
  INDEX `MfaEnrollment_enabled_enrollmentExpiresAt_idx`(`enabled`, `enrollmentExpiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MfaEnrollment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MfaRecoveryCode` (
  `id` VARCHAR(30) NOT NULL,
  `enrollmentId` VARCHAR(30) NOT NULL,
  `codeHash` CHAR(64) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MfaRecoveryCode_enrollmentId_codeHash_key`(`enrollmentId`, `codeHash`),
  INDEX `MfaRecoveryCode_enrollmentId_usedAt_idx`(`enrollmentId`, `usedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MfaRecoveryCode_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `MfaEnrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MfaChallenge` (
  `id` VARCHAR(64) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `sessionId` VARCHAR(30) NOT NULL,
  `challengeHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MfaChallenge_challengeHash_key`(`challengeHash`),
  INDEX `MfaChallenge_userId_expiresAt_idx`(`userId`, `expiresAt`),
  INDEX `MfaChallenge_sessionId_consumedAt_idx`(`sessionId`, `consumedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MfaChallenge_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MfaChallenge_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `RefreshSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
