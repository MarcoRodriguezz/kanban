/**
 * Configuración del datasource para Prisma 7
 * En Prisma 7, la URL de conexión se configura aquí en lugar de schema.prisma
 * Ver: https://pris.ly/d/config-datasource
 */
import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

// Limpiar la URL de comillas si las tiene (dotenv a veces las agrega)
const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL || env('DATABASE_URL');
  // Remover comillas al inicio y final si existen
  return url.replace(/^["']|["']$/g, '');
};

export default defineConfig({
  schema: './schema.prisma',
  datasource: {
    url: getDatabaseUrl(),
  },
});

