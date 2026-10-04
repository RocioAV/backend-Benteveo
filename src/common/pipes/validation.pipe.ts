import {
  HttpStatus,
  Injectable,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes';

/**
 * Pipe de validación global.
 *
 * Delega en el ValidationPipe nativo de Nest con `whitelist` +
 * `forbidNonWhitelisted` + `transform`. Los errores de validación se emiten
 * como `AppException` 422 `VALIDATION_FAILED` con `fields:{campo:mensaje}`.
 */
@Injectable()
export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new AppException(
          ErrorCode.VALIDATION_FAILED,
          'Validación fallida',
          HttpStatus.UNPROCESSABLE_ENTITY,
          flattenValidationErrors(errors),
        ),
    });
  }
}

/**
 * Aplana los errores de validación a `{ campo: primerMensaje }`, con notación
 * de punto para campos anidados (p.ej. `profile.phone`).
 */
function flattenValidationErrors(
  errors: ValidationError[],
  prefix = '',
): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property;

    if (error.constraints) {
      const [message] = Object.values(error.constraints);
      fields[path] = message;
    }

    if (error.children && error.children.length > 0) {
      Object.assign(fields, flattenValidationErrors(error.children, path));
    }
  }

  return fields;
}
