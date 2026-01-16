-- AlterTable
ALTER TABLE `repositorios_github` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX `repositorios_github_activo_idx` ON `repositorios_github`(`activo`);

