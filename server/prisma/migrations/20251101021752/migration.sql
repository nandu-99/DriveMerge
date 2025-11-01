-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `googleId` VARCHAR(191) NULL,
    `profilePicture` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_googleId_key`(`googleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DriveAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `refreshToken` VARCHAR(1000) NOT NULL,
    `accessToken` TEXT NULL,
    `usedSpaceGb` DOUBLE NOT NULL,
    `totalSpaceGb` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DriveAccount_userId_email_key`(`userId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DriveAccount` ADD CONSTRAINT `DriveAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
