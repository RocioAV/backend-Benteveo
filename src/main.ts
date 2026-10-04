import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Parsea cookies entrantes (`req.cookies`) para la sesión HttpOnly + CSRF.
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();