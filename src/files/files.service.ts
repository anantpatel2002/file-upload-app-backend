// src/files/files.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import * as fs from 'fs/promises';
import {PDFParse, TextResult} from 'pdf-parse';
import { uploaded_file } from '@prisma/client';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private prisma: PrismaService,
    private search: SearchService,
  ) {}

  /**
   * Helper to delete a file from disk.
   */
  public async cleanupFile(filePath: string) {
    try {
      await fs.unlink(filePath);
      this.logger.log(`Cleaned up file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup file ${filePath}:`, error.message);
    }
  }

  /**
   * Processes and saves an uploaded PDF file.
   */
  async processPdfUpload(
    file: Express.Multer.File,
    title: string,
  ): Promise<uploaded_file> {
    let dataBuffer: Buffer;
    try {
      dataBuffer = await fs.readFile(file.path);
    } catch (readError) {
      this.logger.error('Failed to read uploaded file', readError);
      await this.cleanupFile(file.path);
      throw new InternalServerErrorException('Failed to read uploaded file');
    }

    // 1. Parse PDF
    let pdfData: TextResult;
    try {
      const parser = new PDFParse({ data: dataBuffer });
      pdfData = await parser.getText();
      await parser.destroy();
    } catch (parseError) {
      this.logger.error('Failed to parse PDF', parseError);
      await this.cleanupFile(file.path);
      throw new BadRequestException('Failed to parse PDF file.');
    }

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      await this.cleanupFile(file.path);
      throw new BadRequestException('PDF contains no extractable text.');
    }

    // 2. Create metadata
    const fileMetadata = {
      title: title?.trim() || file.originalname,
      originalname: file.originalname,
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size,
      extractedText: pdfData.text.trim(),
      fileType: 'pdf',
    };

    // 3. Save to DB
    let newFile: uploaded_file;
    try {
      newFile = await this.prisma.uploaded_file.create({
        data: fileMetadata,
      });
    } catch (dbError) {
      this.logger.error('Failed to save file to DB', dbError);
      await this.cleanupFile(file.path);
      throw new InternalServerErrorException(
        'Failed to save file metadata to database.',
      );
    }

    // 4. Add to search index
    try {
      this.search.addToFileIndex(newFile);
    } catch (searchError) {
      // This is non-critical; log it but don't fail the upload
      this.logger.warn('Failed to add file to search index', searchError);
    }

    return newFile;
  }

  /**
   * Processes and saves an uploaded Video file.
   */
  async processVideoUpload(
    file: Express.Multer.File,
    title: string,
  ): Promise<uploaded_file> {
    // 1. Create metadata
    const fileMetadata = {
      title: title?.trim() || file.originalname,
      originalname: file.originalname,
      filename: file.filename,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size,
      extractedText: null, // Videos don't have extracted text [cite: 3]
      fileType: 'video',
    };

    // 2. Save to DB
    let newFile: uploaded_file;
    try {
      newFile = await this.prisma.uploaded_file.create({
        data: fileMetadata,
      });
    } catch (dbError) {
      this.logger.error('Failed to save video to DB', dbError);
      await this.cleanupFile(file.path);
      throw new InternalServerErrorException(
        'Failed to save file metadata to database.',
      );
    }

    // 3. Add to search index (will index on title/originalname)
    try {
      this.search.addToFileIndex(newFile);
    } catch (searchError) {
      this.logger.warn('Failed to add video to search index', searchError);
    }

    return newFile;
  }

  /**
   * Gets all files (simplified list).
   */
  async getAllFiles() {
    try {
      // This replicates your db.getFiles logic
      return await this.prisma.uploaded_file.findMany({
        orderBy: {
          uploadDate: 'desc',
        },
        select: {
          id: true,
          title: true,
          originalname: true,
          size: true,
          uploadDate: true,
          fileType: true,
        },
      });
    } catch (error) {
      this.logger.error('Error getting all files', error);
      throw new InternalServerErrorException('Error retrieving files.');
    }
  }

  /**
   * Gets a single file by ID (full details).
   */
  async getFileById(id: string) {
    try {
      const file = await this.prisma.uploaded_file.findUnique({
        where: { id },
      });

      if (!file) {
        throw new NotFoundException('File not found.');
      }
      return file;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error getting file by ID ${id}`, error);
      throw new InternalServerErrorException('Error retrieving file.');
    }
  }

  /**
   * Deletes a file by ID.
   */
  async deleteFile(id: string) {
    // 1. Get file details (we need the path)
    const file = await this.getFileById(id); // Will throw 404 if not found

    // 2. Delete physical file
    await this.cleanupFile(file.path); 

    // 3. Delete from database
    try {
      await this.prisma.uploaded_file.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to delete file from DB: ${id}`, error);
      throw new InternalServerErrorException(
        'Failed to delete file from database.',
      );
    }

    // 4. Remove from search index
    try {
      this.search.removeFromFileIndex(id);
    } catch (searchError) {
      this.logger.warn(
        `Failed to remove file ${id} from search index`,
        searchError,
      );
    }

    return { message: 'File deleted successfully.' };
  }

  /**
   * Searches for files.
   */
  async searchFiles(query: string) {
    const matchingIds = this.search.searchIndex(query.trim().toLowerCase());

    if (matchingIds.length === 0) {
      return [];
    }

    try {
      // Replicates db.getFilesByIds
      const files = await this.prisma.uploaded_file.findMany({
        where: {
          id: {
            in: matchingIds,
          },
        },
        select: {
          id: true,
          title: true,
          originalname: true,
          size: true,
          uploadDate: true,
          fileType: true,
          extractedText: true, // For snippet
        },
      });

      // Format with snippet
      return files.map((file) => ({
        ...file,
        snippet: file.extractedText
          ? file.extractedText.substring(0, 200) + '...'
          : '',
      }));
    } catch (error) {
      this.logger.error('Error searching files in DB', error);
      throw new InternalServerErrorException('Error searching files.');
    }
  }
}