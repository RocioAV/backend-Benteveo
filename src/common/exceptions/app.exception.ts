import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

/**
 * Excepción base del contrato de error.
 *
 * Extiende `HttpException` y expone `code` (taxonomía estable) y `fields`
 * (errores por campo, `null` salvo en 422). El `HttpExceptionFilter` único la
 * serializa a `{ code, message, fields, requestId }`.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly fields: Record<string, string> | null;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    fields: Record<string, string> | null = null,
  ) {
    super({ code, message, fields }, status);
    this.code = code;
    this.fields = fields;
  }
}
