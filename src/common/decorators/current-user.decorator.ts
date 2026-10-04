import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/user.types';

export type { AuthenticatedUser };

/**
 * Factoría extraída para poder testearla de forma aislada.
 * Devuelve el usuario completo o, si se pasa una clave, solo ese campo.
 */
export function getCurrentUser(
  data: keyof AuthenticatedUser | undefined,
  ctx: ExecutionContext,
): AuthenticatedUser | string | boolean | undefined {
  const request = ctx.switchToHttp().getRequest();
  const user = request?.user as AuthenticatedUser | undefined;
  return data ? user?.[data] : user;
}

/** Decorador de parámetro que inyecta el usuario autenticado (o un campo suyo). */
export const CurrentUser = createParamDecorator(getCurrentUser);
