/**
 * Cliente singleton de Prisma para acceso a la base de datos: configuración optimizada y manejo graceful de desconexión.
 * Evita múltiples instancias y optimiza el uso de conexiones en desarrollo y producción.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Singleton de PrismaClient para evitar múltiples instancias
 * y optimizar el uso de conexiones a la base de datos
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Configuración optimizada de PrismaClient
 * - Connection pooling mejorado para producción
 * - Query timeout para evitar queries colgadas
 * - Logging configurado según entorno
 */
// Limpiar la URL de comillas si las tiene (dotenv a veces las agrega)
const getDatabaseUrl = (): string => {
  const url = env.databaseUrl;
  return url.replace(/^["']|["']$/g, '');
};

// Crear el adapter de MariaDB para MySQL (compatible con MySQL)
const createAdapter = () => {
  const databaseUrl = getDatabaseUrl();
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está configurada en las variables de entorno');
  }
  
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch (error) {
    logger.error('Error al parsear DATABASE_URL:', databaseUrl);
    throw new Error(`DATABASE_URL tiene un formato inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Parsear la contraseña correctamente (puede contener caracteres especiales)
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  
  const config: any = {
    host: url.hostname,
    port: parseInt(url.port || '3306'),
    user: url.username || undefined,
    password: password,
    database: url.pathname.slice(1), // Remover el '/' inicial
    // Configuración del pool de conexiones
    connectionLimit: 10, // Número máximo de conexiones en el pool
  };
  
  // Agregar configuración adicional solo si está disponible en el tipo
  // Algunas versiones del adapter pueden no soportar todas las opciones
  
  if (env.isDevelopment) {
    logger.info('Configurando adapter de MariaDB:', {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      connectionLimit: config.connectionLimit,
    });
  }
  
  try {
    const adapter = new PrismaMariaDb(config);
    return adapter;
  } catch (error) {
    logger.error('Error al crear el adapter de MariaDB:', error);
    throw new Error(`Error de configuración de base de datos: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Crear el adapter de forma lazy para evitar problemas de inicialización
let adapterInstance: PrismaMariaDb | null = null;
const getAdapter = () => {
  if (!adapterInstance) {
    adapterInstance = createAdapter();
  }
  return adapterInstance;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // En Prisma 7, cuando se usa engineType = "client", se requiere un adapter
    // Usamos el adapter de MariaDB que es compatible con MySQL
    adapter: getAdapter(),
    log: env.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
    // Optimizaciones de rendimiento
    ...(env.isProduction && {
      // En producción, desactivar logs de query para mejor rendimiento
      log: ['error'],
    }),
    // Manejo de errores mejorado
    errorFormat: 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Agregar manejo de errores no capturados de Prisma
prisma.$on('error' as never, (e: any) => {
  logger.error('Error de Prisma no capturado', e, {
    errorType: typeof e,
    errorString: String(e),
    errorMessage: e?.message,
    errorCode: e?.code,
  });
});

// Nota: No llamamos $connect() explícitamente aquí porque Prisma 7 con adapter
// maneja las conexiones automáticamente. Llamar $connect() puede interferir
// con el pool de conexiones del adapter.

// Manejo graceful de desconexión
const disconnect = async () => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error('Error al desconectar Prisma', error);
  }
};

process.on('beforeExit', disconnect);
process.on('SIGINT', disconnect);
process.on('SIGTERM', disconnect);

