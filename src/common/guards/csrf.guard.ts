import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../constants/cookies';
import { CsrfTokenInvalidException } from '../exceptions/auth-exceptions';

/** Métodos que no mutan estado: no requieren token CSRF. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Usuario decodificado del JWT (payload con el claim `csrf`). */
interface CsrfClaims {
  csrf?: string;
}

/**
 * Compara dos strings en tiempo constante (timing-safe), para no filtrar
 * información por diferencias de tiempo de comparación.
 */
export function safeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Protección CSRF por doble submit firmado.
 *
 * Para métodos unsafe (POST/PATCH/PUT/DELETE) sobre rutas autenticadas exige
 * que el header `X-CSRF-Token` coincida con la cookie `benteveo_csrf` y con el
 * claim `csrf` del JWT (triple igualdad). Corre DESPUÉS del AuthGuard, que ya
 * seteó `request.user` con el payload verificado.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: CsrfClaims }>();

    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const header = request.headers?.[CSRF_HEADER_NAME];
    const cookie = request.cookies?.[CSRF_COOKIE_NAME];
    const claim = request.user?.csrf;

    if (
      typeof header === 'string' &&
      typeof cookie === 'string' &&
      typeof claim === 'string' &&
      safeStringEqual(header, cookie) &&
      safeStringEqual(header, claim)
    ) {
      return true;
    }

    throw new CsrfTokenInvalidException();
  }
}
