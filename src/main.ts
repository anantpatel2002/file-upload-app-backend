// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import * as fs from 'fs';
import * as timeout from 'connect-timeout';

// --- Ensure Uploads Directory Exists ---
const UPLOADS_DIR = join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('Created uploads directory');
}
// ----------------------------------------

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // --- Enable CORS ---
  app.enableCors();

  // --- Set up Request Timeouts ---
  // This is your original timeout middleware
  app.use(timeout.default('30s'));
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.timedout) {
      next();
    } else {
      console.error("Request timeout:", req.method, req.path);
      res.status(408).json({
        message: "Request timeout. The operation took too long to complete.",
      });
    }
  });


  // --- Serve Static Files ---
  // This replaces app.use("/uploads", express.static(UPLOADS_DIR));
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR),
  );

  // --- Global Pipes for Validation ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically remove non-whitelisted properties
      transform: true, // Automatically transform payloads to DTO types
    }),
  );

  // --- Start Server ---
  const PORT = process.env.PORT || 3000;
  await app.listen(PORT);
  console.log(`Backend server is running on http://localhost:${PORT}`);
}
bootstrap();