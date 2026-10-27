-- ADFLICK Client SRS v1.0 non-financial member genealogy foundation.
-- Additive only. No data migration/backfill, e-PIN issue/redemption, paid joining,
-- sponsor placement correction, earnings, or payout activation.
-- Application production migration remains a separately approved operator action.

ALTER TABLE `UserRoleAssignment`
  MODIFY COLUMN `role` ENUM(
    'SUPER_ADMIN','ORGANIZATION_ADMIN','ADVERTISER','SCREEN_OWNER',
    'CONTENT_MANAGER','OPERATIONS_MANAGER','FINANCE_MANAGER',
    'SUPPORT_AGENT','AUDITOR_COMPLIANCE','MEMBER'
  ) NOT NULL;

-- The existing User table is organization-scoped; make the composite identity
-- referenceable so a MemberProfile cannot link to a User in another tenant.
ALTER TABLE `User`
  ADD UNIQUE INDEX `User_id_organizationId_key`(`id`,`organizationId`);

CREATE TABLE `MemberProfile` (
  `id` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `userId` VARCHAR(30) NOT NULL,
  `memberCode` VARCHAR(40) NOT NULL,
  `status` ENUM('PENDING_ACTIVATION','ACTIVE','SUSPENDED') NOT NULL DEFAULT 'PENDING_ACTIVATION',
  `activatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MemberProfile_userId_key`(`userId`),
  UNIQUE INDEX `MemberProfile_organizationId_id_key`(`organizationId`,`id`),
  UNIQUE INDEX `MemberProfile_organizationId_memberCode_key`(`organizationId`,`memberCode`),
  INDEX `MemberProfile_organizationId_status_createdAt_idx`(`organizationId`,`status`,`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MemberProfile_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MemberProfile_userId_organizationId_fkey`
    FOREIGN KEY (`userId`,`organizationId`) REFERENCES `User`(`id`,`organizationId`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SponsorRelationship` (
  `memberId` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `sponsorMemberId` VARCHAR(30) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SponsorRelationship_organizationId_sponsorMemberId_idx`(`organizationId`,`sponsorMemberId`),
  PRIMARY KEY (`memberId`),
  CONSTRAINT `SponsorRelationship_not_self` CHECK (`memberId` <> `sponsorMemberId`),
  CONSTRAINT `SponsorRelationship_organizationId_memberId_fkey`
    FOREIGN KEY (`organizationId`,`memberId`) REFERENCES `MemberProfile`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SponsorRelationship_organizationId_sponsorMemberId_fkey`
    FOREIGN KEY (`organizationId`,`sponsorMemberId`) REFERENCES `MemberProfile`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BinaryTreeRoot` (
  `organizationId` VARCHAR(30) NOT NULL,
  `memberId` VARCHAR(30) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `BinaryTreeRoot_memberId_key`(`memberId`),
  PRIMARY KEY (`organizationId`),
  CONSTRAINT `BinaryTreeRoot_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `BinaryTreeRoot_organizationId_memberId_fkey`
    FOREIGN KEY (`organizationId`,`memberId`) REFERENCES `MemberProfile`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlacementNode` (
  `memberId` VARCHAR(30) NOT NULL,
  `organizationId` VARCHAR(30) NOT NULL,
  `parentMemberId` VARCHAR(30) NOT NULL,
  `side` ENUM('LEFT','RIGHT') NOT NULL,
  `placedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `PlacementNode_parentMemberId_side_key`(`parentMemberId`,`side`),
  INDEX `PlacementNode_organizationId_parentMemberId_side_idx`(`organizationId`,`parentMemberId`,`side`),
  PRIMARY KEY (`memberId`),
  CONSTRAINT `PlacementNode_not_self` CHECK (`memberId` <> `parentMemberId`),
  CONSTRAINT `PlacementNode_organizationId_memberId_fkey`
    FOREIGN KEY (`organizationId`,`memberId`) REFERENCES `MemberProfile`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PlacementNode_organizationId_parentMemberId_fkey`
    FOREIGN KEY (`organizationId`,`parentMemberId`) REFERENCES `MemberProfile`(`organizationId`,`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
