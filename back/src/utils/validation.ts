/**
 * Utilidades para validación y sanitización de entrada: parseo de IDs, sanitización de strings y emails.
 * Previene XSS eliminando HTML, scripts y caracteres peligrosos de las entradas del usuario.
 */

/**
 * Parsea un ID de string a número, retorna null si es inválido
 */
export const parseId = (id: string | undefined): number | null => {
  if (!id) return null;
  const parsed = parseInt(id, 10);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Valida un ID y lanza error si es inválido
 */
export const validateId = (id: string | undefined, resourceName: string = 'ID'): number => {
  const parsed = parseId(id);
  if (parsed === null || parsed < 1) {
    throw new Error(`${resourceName} inválido`);
  }
  return parsed;
};

/**
 * Sanitiza un string eliminando caracteres peligrosos para prevenir XSS
 * Elimina HTML tags, scripts y event handlers
 */
export const sanitizeString = (input: string | undefined | null): string => {
  if (!input) return '';
  
  return input
    .trim()
    // Eliminar HTML tags
    .replace(/<[^>]*>/g, '')
    // Eliminar scripts y eventos
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:/gi, '')
    // Eliminar caracteres de control
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalizar espacios múltiples
    .replace(/\s+/g, ' ');
};

/**
 * Sanitiza un email
 */
export const sanitizeEmail = (email: string | undefined | null): string => {
  if (!email) return '';
  return email.trim().toLowerCase();
};

/**
 * Sanitiza un número (solo permite números)
 */
export const sanitizeNumber = (input: string | number | undefined | null): number | null => {
  if (typeof input === 'number') {
    return isNaN(input) ? null : input;
  }
  if (!input) return null;
  
  const num = Number(input);
  return isNaN(num) ? null : num;
};

/**
 * Valida y sanitiza un ID
 */
export const sanitizeId = (id: string | number | undefined | null): number | null => {
  const num = sanitizeNumber(id);
  if (num === null || num < 1) return null;
  return Math.floor(num);
};

/**
 * Limita la longitud de un string
 */
export const limitLength = (input: string, maxLength: number): string => {
  if (!input) return '';
  return input.substring(0, maxLength);
};

