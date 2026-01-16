/**
 * Sistema de health checks para monitoreo: verifica conectividad de base de datos y uso de memoria.
 * Proporciona endpoints /health/live y /health/ready para Kubernetes y load balancers.
 */
import { prisma } from './prisma';
import os from 'os';

type Status = 'healthy' | 'unhealthy' | 'degraded';

interface CheckResult {
  status: Status;
  responseTime?: number;
  message?: string;
}

const DB_TIMEOUT = 2000;
const MEMORY_WARNING = 85;
const MEMORY_CRITICAL = 95;

const checkDatabase = async (): Promise<CheckResult> => {
  const start = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), DB_TIMEOUT)
      ),
    ]);
    
    const responseTime = Date.now() - start;
    return {
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database error',
    };
  }
};

const checkMemory = (): CheckResult => {
  const used = os.totalmem() - os.freemem();
  const percentage = (used / os.totalmem()) * 100;
  
  return {
    status: percentage >= MEMORY_CRITICAL ? 'unhealthy' 
           : percentage >= MEMORY_WARNING ? 'degraded' 
           : 'healthy',
    message: `${Math.round(percentage)}% memory used`,
  };
};

export const getHealthStatus = async () => {
  const [db, memory] = await Promise.all([checkDatabase(), Promise.resolve(checkMemory())]);
  
  const status: Status = db.status === 'unhealthy' || memory.status === 'unhealthy' 
    ? 'unhealthy' 
    : db.status === 'degraded' || memory.status === 'degraded' 
    ? 'degraded' 
    : 'healthy';

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '1.0.0',
    checks: { database: db, memory },
  };
};

export const getQuickHealth = () => ({
  status: 'OK',
  timestamp: new Date().toISOString(),
  uptime: Math.floor(process.uptime()),
});

