/**
 * Constantes centralizadas del sistema: roles, estados de tareas, acciones de auditoría, límites de servidor y seguridad.
 * Define todos los valores constantes reutilizables para mantener consistencia en toda la aplicación.
 */
export const ROLES = {
  ADMINISTRADOR: 'Administrador',
  EMPLEADO: 'Empleado',
} as const;

export type RolUsuario = typeof ROLES[keyof typeof ROLES];

/**
 * Estados válidos de tareas
 */
export const ESTADOS_TAREA = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En_progreso',
  EN_REVISION: 'En_revision',
  COMPLETADO: 'Completado',
} as const;

export type EstadoTarea = typeof ESTADOS_TAREA[keyof typeof ESTADOS_TAREA];

/**
 * Estados para iteración
 */
export const ESTADOS_TAREA_ARRAY = Object.values(ESTADOS_TAREA) as readonly EstadoTarea[];

/**
 * Acciones de auditoría
 */
export const ACCIONES_AUDITORIA = {
  CREAR: 'crear',
  ACTUALIZAR: 'actualizar',
  ELIMINAR: 'eliminar',
  CAMBIAR_ESTADO: 'cambiar_estado',
} as const;

/**
 * Entidades del sistema
 */
export const ENTIDADES = {
  TAREA: 'Tarea',
  PROYECTO: 'Proyecto',
  COMENTARIO: 'Comentario',
  ARCHIVO: 'Archivo',
  ETIQUETA: 'Etiqueta',
  SPRINT: 'Sprint',
  RELEASE: 'Release',
  COMPONENTE: 'Componente',
} as const;

/**
 * Estados válidos de Sprint
 */
export const ESTADOS_SPRINT = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En_progreso',
  COMPLETADO: 'Completado',
} as const;

export type EstadoSprint = typeof ESTADOS_SPRINT[keyof typeof ESTADOS_SPRINT];

/**
 * Estados válidos de Release
 */
export const ESTADOS_RELEASE = {
  EN_PROGRESO: 'En_progreso',
  SIN_LANZAR: 'Sin_lanzar',
  PUBLICADO: 'Publicado',
} as const;

export type EstadoRelease = typeof ESTADOS_RELEASE[keyof typeof ESTADOS_RELEASE];

/**
 * Constantes de tiempo (en milisegundos)
 */
export const TIME_CONSTANTS = {
  ONE_HOUR_MS: 60 * 60 * 1000,
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  SEVEN_DAYS_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Constantes de seguridad
 */
export const SECURITY_CONSTANTS = {
  RESET_TOKEN_BYTES: 32,
  BCRYPT_ROUNDS: 10,
} as const;

/**
 * Tipos MIME permitidos para archivos
 */
export const ALLOWED_FILE_TYPES = {
  PDF: 'application/pdf',
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  SVG: 'image/svg+xml',
} as const;

export const ALLOWED_MIME_TYPES = Object.values(ALLOWED_FILE_TYPES);

/**
 * Extensiones de archivo permitidas
 */
export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.svg'] as const;

/**
 * Constantes de servidor
 */
export const SERVER_CONSTANTS = {
  KEEP_ALIVE_TIMEOUT_MS: 65000,
  HEADERS_TIMEOUT_MS: 66000,
  COMPRESSION_THRESHOLD_BYTES: 1024,
  COMPRESSION_LEVEL: 6,
  MAX_FILE_SIZE_MB: 25,
  MAX_FILE_SIZE_BYTES: 25 * 1024 * 1024,
  MAX_TOTAL_SIZE_PER_TASK_MB: 25,
  MAX_TOTAL_SIZE_PER_TASK_BYTES: 25 * 1024 * 1024,
} as const;

/**
 * Constantes de rate limiting (en milisegundos)
 */
export const RATE_LIMIT_CONSTANTS = {
  AUTH_WINDOW_MS: 15 * 60 * 1000, // 15 minutos
  AUTH_MAX_REQUESTS: 5,
  PASSWORD_RESET_WINDOW_MS: 60 * 60 * 1000, // 1 hora
  PASSWORD_RESET_MAX_REQUESTS: 3,
  STANDARD_WINDOW_MS: 15 * 60 * 1000, // 15 minutos
  STANDARD_MAX_REQUESTS: 100,
} as const;

