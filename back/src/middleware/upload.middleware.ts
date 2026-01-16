/**
 * Middleware de carga de archivos con Multer: valida tipos MIME, extensiones y tamaño máximo de archivos.
 * Configura almacenamiento en disco y filtros de seguridad.
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { SERVER_CONSTANTS, ALLOWED_MIME_TYPES, ALLOWED_FILE_EXTENSIONS } from '../utils/constants';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadsDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

//Valida tipo de archivo
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
//Valida extensión de archivo
  if (!ALLOWED_FILE_EXTENSIONS.includes(fileExtension as typeof ALLOWED_FILE_EXTENSIONS[number])) {
    cb(new Error(`Tipo de archivo no permitido. Solo se admiten: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`));
    return;
  }

// Valida tipo MIME
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_MIME_TYPES[number])) {
    cb(new Error(`Tipo MIME no permitido. Solo se admiten: PDF, JPG, PNG y SVG`));
    return;
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: SERVER_CONSTANTS.MAX_FILE_SIZE_BYTES },
  fileFilter,
});

// Middleware específico para fotos de perfil (solo imágenes, máximo 2MB)
const profilePhotoFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];
  
  if (!allowedExtensions.includes(fileExtension)) {
    cb(new Error('Tipo de archivo no permitido. Solo se admiten: JPG y PNG'));
    return;
  }

  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Tipo MIME no permitido. Solo se admiten: JPG y PNG'));
    return;
  }

  cb(null, true);
};

export const uploadProfilePhoto = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB máximo
  fileFilter: profilePhotoFileFilter,
});

