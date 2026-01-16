/**
 * Utilidades para cifrado y descifrado de datos sensibles
 * Usa AES-256-GCM para cifrado simétrico seguro
 */
import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes para AES
const SALT_LENGTH = 64; // 64 bytes para la sal
const KEY_LENGTH = 32; // 32 bytes para AES-256

/**
 * Deriva una clave de cifrado desde una clave maestra usando PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Cifra un texto usando AES-256-GCM
 * Retorna un string en formato: salt:iv:tag:encryptedData (todos en base64)
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('No se puede cifrar un texto vacío');
  }

  // Usar JWT_SECRET como clave maestra
  const masterKey = env.jwtSecret;
  if (!masterKey) {
    throw new Error('JWT_SECRET no está configurado. No se puede cifrar.');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derivar clave desde la clave maestra
  const key = deriveKey(masterKey, salt);

  // Crear cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Cifrar
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  // Combinar todo: salt:iv:tag:encryptedData
  return `${salt.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
}

/**
 * Descifra un texto cifrado con encrypt()
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('No se puede descifrar un texto vacío');
  }

  // Usar JWT_SECRET como clave maestra
  const masterKey = env.jwtSecret;
  if (!masterKey) {
    throw new Error('JWT_SECRET no está configurado. No se puede descifrar.');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 4) {
    throw new Error('Formato de texto cifrado inválido');
  }

  const [saltBase64, ivBase64, tagBase64, encrypted] = parts;

  // Convertir de base64 a buffers
  const salt = Buffer.from(saltBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');

  const key = deriveKey(masterKey, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

