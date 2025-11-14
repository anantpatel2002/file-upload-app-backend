import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    // This is a good place to connect to the database
    await this.$connect();
  }

  // We will move the functions from db.js into our new FilesService,
  // but they will *use* this PrismaService.
  // For example, instead of db.addFile(data), we'll do:
  // this.prismaService.uploaded_file.create({ data })
}