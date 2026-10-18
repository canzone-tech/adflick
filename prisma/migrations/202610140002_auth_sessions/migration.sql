ALTER TABLE `User`
  ADD COLUMN `passwordHash` VARCHAR(255) NULL;

CREATE TABLE `RefreshSession` (
  `id` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `replacedById` VARCHAR(30) NULL,
  `userAgent` VARCHAR(512) NULL,
  `ipAddress` VARCHAR(45) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RefreshSession_tokenHash_key`(`tokenHash`),
  INDEX `RefreshSession_userId_expiresAt_idx`(`userId`, `expiresAt`),
  INDEX `RefreshSession_revokedAt_expiresAt_idx`(`revokedAt`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RefreshSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
