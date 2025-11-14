import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import {
  commonDiskStorage,
  pdfFileFilter,
  videoFileFilter,
} from './multer.config';
import { MulterError } from 'multer';

@Controller() // We'll define routes on the methods
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * POST /upload
   * Uploads a PDF file.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: commonDiskStorage,
      fileFilter: pdfFileFilter,
      limits: { fileSize: 105 * 1024 * 1024 }, // 105 MB
    }),
  )
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded or invalid file type.');
    }

    if (title && title.trim().length === 0) {
      // We need to cleanup the file if validation fails *after* upload
      await this.filesService.cleanupFile(file.path);
      throw new BadRequestException('Title cannot be empty.');
    }

    const startTime = Date.now();
    try {
      const newFile = await this.filesService.processPdfUpload(file, title);

      return {
        message: 'File uploaded and processed successfully!',
        file: {
          id: newFile.id,
          title: newFile.title,
          originalname: newFile.originalname,
          uploadDate: newFile.uploadDate,
          size: newFile.size,
          fileType: newFile.fileType,
        },
        processingTime: `${Date.now() - startTime}ms`,
      };
    } catch (error) {
      // Handle service-level errors
      if (!error.status) {
        // If it's not a standard Nest HTTP Exception, wrap it
        throw new BadRequestException(error.message);
      }
      throw error; // Re-throw Nest HTTP exceptions
    }
  }

  /**
   * POST /upload/video
   * Uploads an MP4 video file.
   */
  @Post('upload/video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: commonDiskStorage,
      fileFilter: videoFileFilter,
      limits: { fileSize: 525 * 1024 * 1024 }, // 525 MB
    }),
  )
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded or invalid file type.');
    }

    if (title && title.trim().length === 0) {
      await this.filesService.cleanupFile(file.path);
      throw new BadRequestException('Title cannot be empty.');
    }

    const startTime = Date.now();
    const newFile = await this.filesService.processVideoUpload(file, title);

    return {
      message: 'Video file uploaded successfully!',
      file: {
        id: newFile.id,
        title: newFile.title,
        originalname: newFile.originalname,
        uploadDate: newFile.uploadDate,
        size: newFile.size,
        fileType: newFile.fileType,
      },
      processingTime: `${Date.now() - startTime}ms`,
    };
  }

  /**
   * GET /files
   * Returns a list of all uploaded files.
   */
  @Get('files')
  async getFiles() {
    return this.filesService.getAllFiles();
  }

  /**
   * GET /search?query=...
   * Searches files by title, name, or extracted text.
   */
  @Get('search')
  async searchFiles(@Query('query') query: string) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException(
        'Search query is required and cannot be empty.',
      );
    }
    return this.filesService.searchFiles(query);
  }

  /**
   * GET /files/:id
   * Returns a specific file's details.
   */
  @Get('files/:id')
  async getFileById(@Param('id', ParseUUIDPipe) id: string) {
    // ParseUUIDPipe automatically validates that 'id' is a UUID
    return this.filesService.getFileById(id);
  }

  /**
   * DELETE /files/:id
   * Deletes a file and its metadata.
   */
  @Delete('files/:id')
  @HttpCode(HttpStatus.OK) // Send 200 instead of 204
  async deleteFile(@Param('id', ParseUUIDPipe) id: string) {
    return this.filesService.deleteFile(id);
  }
}