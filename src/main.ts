import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // CORS
  app.enableCors({
    // origin: Define quién tiene permiso de entrar. Solo la URL exacta que pusimos pasará el filtro.
    origin: frontendUrl, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
