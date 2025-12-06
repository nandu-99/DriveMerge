-- CreateTable
CREATE TABLE `TransferJob` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uploadId` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `totalBytes` BIGINT NULL,
    `transferredBytes` BIGINT NULL,
    `errorMessage` TEXT NULL,
    `driveFileId` VARCHAR(191) NULL,
    `sourceAccountId` INTEGER NULL,
    `destAccountId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TransferJob_uploadId_key`(`uploadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TransferJob` ADD CONSTRAINT `TransferJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
