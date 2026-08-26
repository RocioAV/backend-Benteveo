import { ForbiddenException } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';
import type { AuthenticatedUser } from '../types/user.types';

/**
 * Política de KYC reutilizable.
 * Separada del guard para poder usarse en WebSocket/otros transportes.
 */
export class KycPolicy {
  /**
   * Verifica que el usuario tenga identidad verificada.
   * Lanza ForbiddenException (403 AUTH_KYC_REQUIRED) si no.
   */
  static assertVerified(user: AuthenticatedUser | undefined): void {
    if (!user || !user.isIdentityVerified) {
      throw new ForbiddenException({
        code: ErrorCode.AUTH_KYC_REQUIRED,
        message: 'Se requiere verificación de identidad (KYC)',
        fields: null,
      });
    }
  }
}
