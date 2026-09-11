/**
 * Taxonomía estable de códigos de error del contrato de error.
 *
 * El frontend ramifica por `code` (identificador estable), nunca por el texto
 * libre del `message`. Cualquier error conocido del backend debe mapear a uno
 * de estos códigos; los desconocidos caen en `INTERNAL_ERROR`.
 */
export enum ErrorCode {
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',
  AUTH_KYC_REQUIRED = 'AUTH_KYC_REQUIRED',
  AUTH_EMAIL_TAKEN = 'AUTH_EMAIL_TAKEN',
  CSRF_TOKEN_INVALID = 'CSRF_TOKEN_INVALID',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  PAYMENT_ALREADY_APPROVED = 'PAYMENT_ALREADY_APPROVED',
}
