import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { KYC_REQUIRED_KEY } from '../decorators/kyc.decorator';
import { KycPolicy } from '../policies/kyc-policy';
import type { AuthenticatedUser } from '../types/user.types';

/**
 * Guard que exige verificación KYC (isIdentityVerified=true).
 * Se activa solo en handlers decorados con @KycRequired().
 * Usa KycPolicy.assertVerified para la lógica (reutilizable en WS/otros).
 */
@Injectable()
export class KycGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(KYC_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    KycPolicy.assertVerified(user);
    return true;
  }
}
