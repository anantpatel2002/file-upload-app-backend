import { diskStorage } from 'multer';
import { Request } from 'express';

const UPLOADS_DIR = './uploads'; // NestJS runs from root

// Helper to sanitize filenames
const sanitizeFilename = (filename: string) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

/**
 * Common Disk Storage Configuration
 */
export const commonDiskStorage = diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    // Note: We'll ensure UPLOADS_DIR exists in main.ts
    cb(null, UPLOADS_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const sanitizedName = sanitizeFilename(file.originalname);
    const uniqueFilename = `${Date.now()}_${sanitizedName}`;
    cb(null, uniqueFilename);
  },
});

/**
 * File Filter for PDFs
 */
export const pdfFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only .pdf files are allowed!'), false);
  }
};

/**
 * File Filter for Videos
 */
export const videoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (file.mimetype === 'video/mp4') {
    cb(null, true);
  } else {
    cb(new Error('Only .mp4 video files are allowed!'), false);
  }
};