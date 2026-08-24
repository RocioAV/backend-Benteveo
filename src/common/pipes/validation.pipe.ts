import {
  Injectable,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';

/**
 * Pipe de validación global.
 *
 * Delega en el ValidationPipe nativo de Nest con `whitelist` +
 * `forbidNonWhitelisted` + `transform`, de modo que:
 *  - se rechazan campos no declarados en los DTOs (evita mass-assignment), y
 *  - el payload se transforma a una instancia real del DTO.
 */
@Injectable()
export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  }
}
