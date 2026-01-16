-- AlterTable: Actualizar ENUM de EstadoSprint
-- Cambiar de: Planificado, Activo, Completado, Cancelado
-- A: Pendiente, En_progreso, Completado

-- Primero, actualizar los valores de los registros existentes
UPDATE `sprints` SET `estado` = 'Pendiente' WHERE `estado` = 'Planificado' OR `estado` = 'Cancelado' OR `estado` IS NULL OR `estado` = '';
UPDATE `sprints` SET `estado` = 'En_progreso' WHERE `estado` = 'Activo';

-- Modificar el ENUM de sprints
ALTER TABLE `sprints` MODIFY COLUMN `estado` ENUM('Pendiente', 'En_progreso', 'Completado') NOT NULL DEFAULT 'Pendiente';

-- AlterTable: Actualizar ENUM de EstadoRelease
-- Cambiar de: Planificada, En_progreso, En_pruebas, Lanzada, Cancelada
-- A: En_progreso, Sin_lanzar, Publicado

-- Primero, actualizar los valores de los registros existentes
UPDATE `releases` SET `estado` = 'Sin_lanzar' WHERE `estado` = 'Planificada' OR `estado` = 'Cancelada' OR `estado` IS NULL OR `estado` = '';
UPDATE `releases` SET `estado` = 'En_progreso' WHERE `estado` = 'En_pruebas';
UPDATE `releases` SET `estado` = 'Publicado' WHERE `estado` = 'Lanzada';

-- Modificar el ENUM de releases
ALTER TABLE `releases` MODIFY COLUMN `estado` ENUM('En_progreso', 'Sin_lanzar', 'Publicado') NOT NULL DEFAULT 'Sin_lanzar';

