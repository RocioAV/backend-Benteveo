import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SESSION_COOKIE_NAME } from '../constants/cookies';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../types/user.types';

/**
 * Guard global de autenticación.
 *
 * 1. Lee el JWT desde la cookie HttpOnly `benteveo_session` (no del header Bearer).
 * 2. Verifica firma/expiración con JwtService.
 * 3. Revalida el usuario contra BD (`isDeleted:false`) para obtener datos frescos.
 * 4. Setea `request.user` con un objeto `AuthenticatedUser` siempre vigente.
 *
 * Si el usuario fue eliminado o degradado, pierde acceso sin necesidad de re-login.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: { sub: string; email: string; role: string; csrf: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }

    // Revalidar contra BD: usuario fresco, excluye eliminados
    const dbUser = await this.prisma.user.findFirst({
      where: { id: payload.sub, isDeleted: false },
      select: {
        id: true,
        email: true,
        role: true,
        isIdentityVerified: true,
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException();
    }

    request.user = {
      sub: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as AuthenticatedUser['role'],
      isIdentityVerified: dbUser.isIdentityVerified,
    } satisfies AuthenticatedUser;

    return true;
  }
}
