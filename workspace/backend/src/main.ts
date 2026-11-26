import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',');
  app.use('/api/brains', (req: Request, res: Response, next: NextFunction) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (!req.headers.origin || !allowedOrigins.includes(req.headers.origin))) {
      res.status(403).json({ message: 'Origin not allowed' }); return;
    }
    next();
  });
  app.enableCors({ origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173').split(','), credentials: true });
  app.setGlobalPrefix('api', { exclude: ['api/auth/{*path}'] });
  await app.listen(Number(process.env.PORT ?? 3001));
}
bootstrap();
