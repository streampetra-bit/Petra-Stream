import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  // basic request logging
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
    });
    next();
  });
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`Petra-backend listening on ${port}`);
}

bootstrap().catch(err => {
  console.error('Failed to bootstrap backend', err);
  process.exit(1);
});
