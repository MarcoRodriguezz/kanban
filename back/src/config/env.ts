/**
 * Configuración y validación de variables de entorno: carga y valida variables críticas al inicio de la aplicación.
 * Proporciona acceso tipado a todas las configuraciones del sistema.
 */
import 'dotenv/config';

export const validateEnv = (): void => {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET', 
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Faltan las siguientes variables de entorno requeridas: ${missingVars.join(', ')}`
    );
  }

  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET!.length < 16) {
    throw new Error(
      'JWT_SECRET debe tener al menos 16 caracteres en producción'
    );
  }
};

/**
 * Config entorno
 * 
 * Variables de email (opcionales):
 * - EMAIL_HOST: Servidor SMTP (ej: smtp.gmail.com)
 * - EMAIL_PORT: Puerto SMTP (por defecto: 587)
 * - EMAIL_SECURE: true para SSL/TLS (por defecto: false)
 * - EMAIL_USER: Usuario SMTP
 * - EMAIL_PASS: Contraseña SMTP
 * - EMAIL_FROM: Email remitente (opcional)
 * - EMAIL_FROM_NAME: Nombre del remitente (opcional, por defecto: "Sistema Kanban")
 * - FRONTEND_URL: URL del frontend para construir enlaces de recuperación (opcional, por defecto: http://localhost:3000)
 * 
 * Si no se configuran las variables de email, se usará Ethereal Email (servicio de prueba) en desarrollo.
 */
export const env = {
  databaseUrl: process.env.DATABASE_URL!,

  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['*'],

  githubToken: process.env.GITHUB_TOKEN || null,

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
} as const;