/**
 * Middleware de validación con Zod: valida body y query parameters usando schemas de Zod.
 * Factory function genérica que crea validadores reutilizables para body o query params.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query';

const createValidator = (target: ValidationTarget) => (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = target === 'body' ? req.body : req.query;
      // Para query params, asegurar que siempre sea un objeto
      const dataToValidate = target === 'query' 
        ? (data && typeof data === 'object' && !Array.isArray(data) ? data : {})
        : data;
      const validatedData = schema.parse(dataToValidate);
      if (target === 'body') {
        req.body = validatedData;
      } else {
        // req.query es de solo lectura, necesitamos asignar las propiedades individualmente
        Object.assign(req.query, validatedData);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        // Construir mensaje principal más específico
        let mainMessage = 'Error de validación';
        
        // Si hay múltiples campos requeridos faltantes, crear un mensaje combinado
        const requiredFields = errors.filter(err => 
          err.message.includes('requerido') || err.message.includes('required')
        );
        
        if (requiredFields.length > 1) {
          // Mapear nombres de campos a español
          const fieldNames: Record<string, string> = {
            'email': 'Email',
            'contraseña': 'Contraseña',
            'password': 'Contraseña',
            'currentPassword': 'Contraseña actual',
            'newPassword': 'Nueva contraseña',
            'confirmPassword': 'Confirmar contraseña',
            'nombreCompleto': 'Nombre completo',
          };
          
          const missingFields = requiredFields.map(err => {
            const fieldName = err.field;
            return fieldNames[fieldName] || fieldName;
          });
          
          if (missingFields.length === 2 && 
              (missingFields.includes('Email') && missingFields.includes('Contraseña'))) {
            mainMessage = 'Email y contraseña son requeridos';
          } else {
            mainMessage = `${missingFields.join(' y ')} son requeridos`;
          }
        } else if (errors.length > 0) {
          const firstError = errors[0];
          const fieldName = firstError.field === 'currentPassword' ? 'Contraseña actual' :
                           firstError.field === 'newPassword' ? 'Nueva contraseña' :
                           firstError.field === 'confirmPassword' ? 'Confirmar contraseña' :
                           firstError.field === 'email' ? 'Email' :
                           firstError.field === 'contraseña' ? 'Contraseña' :
                           firstError.field;
          mainMessage = `${fieldName}: ${firstError.message}`;
          // Si hay múltiples errores, agregar indicador
          if (errors.length > 1) {
            mainMessage += ` (y ${errors.length - 1} error${errors.length - 1 > 1 ? 'es' : ''} más)`;
          }
        }
        
        res.status(400).json({
          error: mainMessage,
          message: mainMessage,
          details: errors,
        });
        return;
      }
      // Log del error para debugging en desarrollo/test
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error en validación:', error);
      }
      res.status(500).json({ 
        error: 'Error interno del servidor al validar los datos' 
      });
    }
  };
};

export const validate = createValidator('body');
export const validateQuery = createValidator('query');

