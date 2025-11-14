// src/search/search.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Document } from 'flexsearch';
import { PrismaService } from '../prisma/prisma.service';
import { uploaded_file } from '@prisma/client';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly index: Document<any>;
  private readonly logger = new Logger(SearchService.name);

  // Inject the PrismaService
  constructor(private prisma: PrismaService) {
    this.index = new Document({
      document: {
        id: 'id',
        index: ['title', 'originalname', 'extractedText'],
      },
      tokenize: 'full',
      // Add other Flexsearch options as needed
    });
  }

  // This lifecycle hook runs once the module has been initialized
  async onModuleInit() {
    await this.initializeIndex();
  }

  /**
   * Loads all files from the DB and builds the search index.
   * This replaces your initializeIndex(db.getFiles) call.
   */
  async initializeIndex() {
    this.logger.log('Initializing search index...');
    try {
      // Re-create the logic from db.js's getFiles
      const files = await this.prisma.uploaded_file.findMany({
        select: {
          id: true,
          title: true,
          originalname: true,
          extractedText: true,
        },
      });

      if (files.length === 0) {
        this.logger.log('No files found to index.');
        return;
      }

      files.forEach((file) => {
        this.index.add({
          id: file.id,
          title: file.title,
          originalname: file.originalname,
          extractedText: file.extractedText || '', // Ensure no nulls
        });
      });

      this.logger.log(`Search index initialized with ${files.length} documents.`);
    } catch (error) {
      this.logger.error('Failed to initialize search index', error);
    }
  }

  /**
   * Adds a new file to the search index.
   */
  addToFileIndex(file: uploaded_file) {
    this.logger.log(`Indexing file: ${file.id}`);
    this.index.add({
      id: file.id,
      title: file.title,
      originalname: file.originalname,
      extractedText: file.extractedText || '',
    });
  }

  /**
   * Removes a file from the search index.
   */
  removeFromFileIndex(id: string) {
    this.logger.log(`Removing file from index: ${id}`);
    this.index.remove(id);
  }

  /**
   * Searches the index and returns an array of matching IDs.
   */
  searchIndex(query: string): string[] {
    this.logger.log(`Searching for: ${query}`);
    const results = this.index.search(query, {
      index: ['title', 'originalname', 'extractedText'],
      suggest: true,
    });

    // Flexsearch returns results for each field. We need to flatten and get unique IDs.
    const idSet = new Set<string>();
    results.forEach((fieldResult) => {
      fieldResult.result.forEach((id) => {
        idSet.add(id as string);
      });
    });

    return Array.from(idSet);
  }
}