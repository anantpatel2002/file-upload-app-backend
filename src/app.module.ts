// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SearchModule } from './search/search.module';
import { FilesModule } from './files/files.module';
// We will add FilesModule and SearchModule here later

@Module({
  imports: [PrismaModule, SearchModule, FilesModule], 
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}