-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombreCompleto` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `contraseña` VARCHAR(255) NOT NULL,
    `fotoPerfil` VARCHAR(500) NULL,
    `rol` ENUM('Administrador', 'Empleado') NOT NULL DEFAULT 'Empleado',
    `resetToken` VARCHAR(255) NULL,
    `resetTokenExpiry` DATETIME NULL,
    `refreshToken` VARCHAR(255) NULL,
    `refreshTokenExpiry` DATETIME NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `usuarios_email_idx`(`email`),
    INDEX `usuarios_rol_idx`(`rol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proyectos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `responsable` VARCHAR(255) NOT NULL,
    `equipo` VARCHAR(255) NOT NULL,
    `fecha_inicio` DATETIME NOT NULL,
    `fecha_fin` DATETIME NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    `creadoPorId` INTEGER NOT NULL,
    `gestorId` INTEGER NOT NULL,

    INDEX `proyectos_creadoPorId_idx`(`creadoPorId`),
    INDEX `proyectos_gestorId_idx`(`gestorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tareas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `estado` ENUM('Pendiente', 'En_progreso', 'En_revision', 'Completado') NOT NULL DEFAULT 'Pendiente',
    `prioridad` VARCHAR(50) NOT NULL,
    `asignado_a` VARCHAR(255) NOT NULL,
    `fecha_creacion` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_limite` DATETIME NULL,
    `proyectoId` INTEGER NOT NULL,
    `usuarioId` INTEGER NULL,
    `creadoPorId` INTEGER NOT NULL,
    `sprintId` INTEGER NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `tareas_proyectoId_idx`(`proyectoId`),
    INDEX `tareas_usuarioId_idx`(`usuarioId`),
    INDEX `tareas_creadoPorId_idx`(`creadoPorId`),
    INDEX `tareas_sprintId_idx`(`sprintId`),
    INDEX `tareas_estado_idx`(`estado`),
    INDEX `tareas_usuarioId_estado_idx`(`usuarioId`, `estado`),
    INDEX `tareas_proyectoId_estado_idx`(`proyectoId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `archivos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `tipo` VARCHAR(100) NULL,
    `tamaño` INTEGER NULL,
    `tareaId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `archivos_tareaId_idx`(`tareaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comentarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contenido` TEXT NOT NULL,
    `tareaId` INTEGER NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `comentarios_tareaId_idx`(`tareaId`),
    INDEX `comentarios_usuarioId_idx`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `etiquetas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `color` VARCHAR(7) NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `etiquetas_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarea_etiquetas` (
    `tareaId` INTEGER NOT NULL,
    `etiquetaId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tarea_etiquetas_tareaId_idx`(`tareaId`),
    INDEX `tarea_etiquetas_etiquetaId_idx`(`etiquetaId`),
    PRIMARY KEY (`tareaId`, `etiquetaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_actividad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accion` VARCHAR(50) NOT NULL,
    `entidad` VARCHAR(50) NOT NULL,
    `entidadId` INTEGER NOT NULL,
    `campo` VARCHAR(100) NULL,
    `valorAnterior` TEXT NULL,
    `valorNuevo` TEXT NULL,
    `descripcion` TEXT NULL,
    `usuarioId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `log_actividad_entidad_entidadId_idx`(`entidad`, `entidadId`),
    INDEX `log_actividad_usuarioId_idx`(`usuarioId`),
    INDEX `log_actividad_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sprints` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `fecha_inicio` DATETIME NOT NULL,
    `fecha_fin` DATETIME NOT NULL,
    `estado` ENUM('Planificado', 'Activo', 'Completado', 'Cancelado') NOT NULL DEFAULT 'Planificado',
    `proyectoId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `sprints_proyectoId_idx`(`proyectoId`),
    INDEX `sprints_fecha_inicio_fecha_fin_idx`(`fecha_inicio`, `fecha_fin`),
    INDEX `sprints_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `releases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `fecha_inicio` DATETIME NOT NULL,
    `fecha_lanzamiento` DATETIME NOT NULL,
    `estado` ENUM('Planificada', 'En_progreso', 'En_pruebas', 'Lanzada', 'Cancelada') NOT NULL DEFAULT 'Planificada',
    `proyectoId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `releases_proyectoId_idx`(`proyectoId`),
    INDEX `releases_fecha_inicio_fecha_lanzamiento_idx`(`fecha_inicio`, `fecha_lanzamiento`),
    INDEX `releases_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarea_releases` (
    `tareaId` INTEGER NOT NULL,
    `releaseId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tarea_releases_tareaId_idx`(`tareaId`),
    INDEX `tarea_releases_releaseId_idx`(`releaseId`),
    PRIMARY KEY (`tareaId`, `releaseId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `github_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `tokenCifrado` TEXT NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `proyectoId` INTEGER NOT NULL,
    `creadoPorId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `github_tokens_activo_idx`(`activo`),
    INDEX `github_tokens_creadoPorId_idx`(`creadoPorId`),
    INDEX `github_tokens_proyectoId_idx`(`proyectoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repositorios_github` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `owner` VARCHAR(255) NOT NULL,
    `repo` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `tipo` VARCHAR(50) NOT NULL DEFAULT 'github',
    `proyectoId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `repositorios_github_proyectoId_idx`(`proyectoId`),
    INDEX `repositorios_github_owner_repo_idx`(`owner`, `repo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `componentes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `categoria` ENUM('logos', 'iconos', 'ilustraciones', 'fondos') NOT NULL DEFAULT 'logos',
    `preview` VARCHAR(500) NOT NULL,
    `tags` TEXT NULL,
    `proyectoId` INTEGER NULL,
    `creadoPorId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `componentes_proyectoId_idx`(`proyectoId`),
    INDEX `componentes_categoria_idx`(`categoria`),
    INDEX `componentes_creadoPorId_idx`(`creadoPorId`),
    INDEX `componentes_proyectoId_categoria_idx`(`proyectoId`, `categoria`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issues` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NULL,
    `categoria` ENUM('Bug', 'Mejora', 'Idea', 'Pregunta') NOT NULL DEFAULT 'Bug',
    `estado` ENUM('Abierto', 'En_revision', 'Asignado', 'Resuelto') NOT NULL DEFAULT 'Abierto',
    `prioridad` VARCHAR(50) NOT NULL,
    `proyectoId` INTEGER NOT NULL,
    `reportadoPorId` INTEGER NOT NULL,
    `asignadoAId` INTEGER NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `issues_proyectoId_idx`(`proyectoId`),
    INDEX `issues_reportadoPorId_idx`(`reportadoPorId`),
    INDEX `issues_asignadoAId_idx`(`asignadoAId`),
    INDEX `issues_estado_idx`(`estado`),
    INDEX `issues_categoria_idx`(`categoria`),
    INDEX `issues_proyectoId_estado_idx`(`proyectoId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notificaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(255) NOT NULL,
    `descripcion` TEXT NOT NULL,
    `tipo` VARCHAR(50) NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `usuarioId` INTEGER NOT NULL,
    `tareaId` INTEGER NULL,
    `proyectoId` INTEGER NULL,
    `issueId` INTEGER NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `notificaciones_usuarioId_leida_idx`(`usuarioId`, `leida`),
    INDEX `notificaciones_usuarioId_createdAt_idx`(`usuarioId`, `createdAt`),
    INDEX `notificaciones_tareaId_idx`(`tareaId`),
    INDEX `notificaciones_proyectoId_idx`(`proyectoId`),
    INDEX `notificaciones_issueId_idx`(`issueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proyecto_miembros` (
    `proyectoId` INTEGER NOT NULL,
    `usuarioId` INTEGER NOT NULL,
    `createdAt` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`proyectoId`, `usuarioId`),
    INDEX `proyecto_miembros_proyectoId_idx`(`proyectoId`),
    INDEX `proyecto_miembros_usuarioId_idx`(`usuarioId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `proyectos` ADD CONSTRAINT `proyectos_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proyectos` ADD CONSTRAINT `proyectos_gestorId_fkey` FOREIGN KEY (`gestorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tareas` ADD CONSTRAINT `tareas_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tareas` ADD CONSTRAINT `tareas_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tareas` ADD CONSTRAINT `tareas_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tareas` ADD CONSTRAINT `tareas_sprintId_fkey` FOREIGN KEY (`sprintId`) REFERENCES `sprints`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `archivos` ADD CONSTRAINT `archivos_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `tareas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comentarios` ADD CONSTRAINT `comentarios_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `tareas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comentarios` ADD CONSTRAINT `comentarios_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarea_etiquetas` ADD CONSTRAINT `tarea_etiquetas_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `tareas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarea_etiquetas` ADD CONSTRAINT `tarea_etiquetas_etiquetaId_fkey` FOREIGN KEY (`etiquetaId`) REFERENCES `etiquetas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_actividad` ADD CONSTRAINT `log_actividad_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sprints` ADD CONSTRAINT `sprints_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `releases` ADD CONSTRAINT `releases_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarea_releases` ADD CONSTRAINT `tarea_releases_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `tareas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarea_releases` ADD CONSTRAINT `tarea_releases_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `releases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `github_tokens` ADD CONSTRAINT `github_tokens_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `github_tokens` ADD CONSTRAINT `github_tokens_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repositorios_github` ADD CONSTRAINT `repositorios_github_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `componentes` ADD CONSTRAINT `componentes_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `componentes` ADD CONSTRAINT `componentes_creadoPorId_fkey` FOREIGN KEY (`creadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_reportadoPorId_fkey` FOREIGN KEY (`reportadoPorId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_asignadoAId_fkey` FOREIGN KEY (`asignadoAId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_tareaId_fkey` FOREIGN KEY (`tareaId`) REFERENCES `tareas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificaciones` ADD CONSTRAINT `notificaciones_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `issues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proyecto_miembros` ADD CONSTRAINT `proyecto_miembros_proyectoId_fkey` FOREIGN KEY (`proyectoId`) REFERENCES `proyectos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proyecto_miembros` ADD CONSTRAINT `proyecto_miembros_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

