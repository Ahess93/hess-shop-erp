import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const sessionSecret = process.env['SESSION_SECRET'];
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  // Session middleware — HTTP-only, Secure in prod, SameSite strict
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000, // 8-hour idle timeout
      },
    }),
  );

  app.enableCors({
    origin:
      process.env['NODE_ENV'] === 'production'
        ? false
        : 'http://localhost:5173',
    credentials: true,
  });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);
}

bootstrap().catch(console.error);
