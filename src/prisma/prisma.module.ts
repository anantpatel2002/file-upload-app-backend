import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Makes this module available globally
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Export for injection
})
export class PrismaModule {}