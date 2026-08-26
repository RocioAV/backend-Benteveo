import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from '../constants/error-codes';

/**
 * Credenciales de login inválidas (email inexistente, contraseña errónea o
 * usuario eliminado). Mensaje genérico y único para impedir la enumeración de
 * cuentas: nunca revela si el email existe ni el motivo exacto del rechazo.
 */
export class InvalidCredentialsException extends AppException {
  constructor() {
    super(
      ErrorCode.AUTH_INVALID_CREDENTIALS,
      'Credenciales inválidas',
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Token CSRF inválido/ausente en una escritura autenticada por cookie.
 * El CsrfGuard exige `header === cookie === claim.csrf` (doble submit firmado).
 */
export class CsrfTokenInvalidException extends AppException {
  constructor() {
    super(
      ErrorCode.CSRF_TOKEN_INVALID,
      'Token CSRF inválido',
      HttpStatus.FORBIDDEN,
    );
  }
}
