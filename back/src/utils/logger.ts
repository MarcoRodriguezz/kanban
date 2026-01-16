/**
 * Logger estructurado para la aplicación: formato JSON en producción y legible en desarrollo.
 * Incluye contexto automático (service, environment, PID) y método especializado para logging HTTP.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private getBaseContext(): LogContext {
    return {
      service: 'kanban-api',
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
    };
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const fullContext = { ...this.getBaseContext(), ...context };
    
    if (this.isDevelopment) {
      // En desarrollo, formato más legible
      // Si hay una previewUrl de Ethereal, mostrarla de forma destacada
      if (context?.previewUrl && typeof context.previewUrl === 'string' && context.previewUrl.includes('ethereal.email')) {
        const url = context.previewUrl;
        return `[${timestamp}] [${level.toUpperCase()}] ${message}\n` +
               `════════════════════════════════════════════════════════════════════════════════\n` +
               `📧 EMAIL DE PRUEBA (Ethereal Email)\n` +
               `👉 ABRE ESTE ENLACE EN TU NAVEGADOR:\n` +
               `${url}\n` +
               `════════════════════════════════════════════════════════════════════════════════`;
      }
      
      const contextStr = Object.keys(fullContext).length > 3 
        ? ` ${JSON.stringify(fullContext, null, 2)}` 
        : '';
      return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }
    
    // En producción, formato JSON estructurado
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...fullContext,
    });
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const formattedMessage = this.formatMessage(level, message, context);
    
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      default:
        console.log(formattedMessage);
    }
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error: error instanceof Error ? {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        name: error.name,
        ...(this.isProduction && { code: (error as any).code }),
      } : String(error),
    };
    const logMessage = error instanceof Error ? message || error.message : message || String(error);
    this.log('error', logMessage, errorContext);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log con contexto de request HTTP
   */
  http(method: string, path: string, statusCode: number, duration?: number, context?: LogContext): void {
    this.info(`${method} ${path}`, {
      ...context,
      method,
      path,
      statusCode,
      ...(duration && { durationMs: duration }),
    });
  }
}

export const logger = new Logger();

