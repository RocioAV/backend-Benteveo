import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Usar "any" o remover el tipo evita que rompa por discrepancias de versiones de Nest
export function setupSwagger(app: any) {
  const config = new DocumentBuilder()
    .setTitle('Benteveo API')
    .setDescription('Documentación de la API Benteveo')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}