// src/search/search.module.ts
import { Module, Global } from '@nestjs/common';
import { SearchService } from './search.service';

@Global() // Makes this module available globally
@Module({
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}