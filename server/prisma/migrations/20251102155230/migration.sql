-- CreateTable
CREATE TABLE `File` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `driveFileId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `driveAccountId` INTEGER NULL,
    `name` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NULL,
    `sizeBytes` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `File_driveFileId_key`(`driveFileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_driveAccountId_fkey` FOREIGN KEY (`driveAccountId`) REFERENCES `DriveAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
