import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { PrismaService } from '../../prisma/prisma.service';

/** Helper: crea un ExecutionContext falso con cookie y/o Authorization header. */
function createContext(opts: {
  cookie?: string;
  authHeader?: string;
  isPublic?: boolean;
}) {
  const cookies: Record<string, string> = {};
  if (opts.cookie !== undefined) {
    cookies['benteveo_session'] = opts.cookie;
  }

  const request = {
    cookies,
    headers: {
      authorization: opts.authHeader,
    },
  };

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('AuthGuard', () => {
  const mockVerifyAsync = jest.fn<Promise<any>, [string, any]>();
  const mockGetAllAndOverride = jest.fn<boolean, [any, any]>();
  const mockConfigGet = jest.fn<string, [string]>();
  const mockFindFirst = jest.fn();

  const mockJwtService = {
    verifyAsync: mockVerifyAsync,
  } as unknown as JwtService;

  const mockConfigService = {
    get: mockConfigGet,
  } as unknown as ConfigService;

  const mockReflector = {
    getAllAndOverride: mockGetAllAndOverride,
  } as unknown as Reflector;

  const mockPrisma = {
    user: { findFirst: mockFindFirst },
  } as unknown as PrismaService;

  const guard = new AuthGuard(
    mockJwtService,
    mockConfigService,
    mockReflector,
    mockPrisma,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAndOverride.mockReturnValue(false);
    mockConfigGet.mockReturnValue('jwt-secret');
    mockVerifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'a@b.com',
      role: 'USER',
      csrf: 'csrf-nonce',
    });
    mockFindFirst.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      role: 'USER',
      isIdentityVerified: true,
    });
  });

  // ── Rutas públicas ────────────────────────────────────────────────

  it('permite el paso en rutas públicas sin verificar token', async () => {
    mockGetAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(mockVerifyAsync).not.toHaveBeenCalled();
  });

  // ── Lectura desde cookie ──────────────────────────────────────────

  it('lee el JWT desde la cookie benteveo_session (no del header Bearer)', async () => {
    const context = createContext({ cookie: 'jwt-from-cookie' });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(mockVerifyAsync).toHaveBeenCalledWith('jwt-from-cookie', {
      secret: 'jwt-secret',
    });
  });

  it('lanza UnauthorizedException si no hay cookie benteveo_session', async () => {
    await expect(guard.canActivate(createContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockVerifyAsync).not.toHaveBeenCalled();
  });

  it('lanza UnauthorizedException si la cookie está vacía', async () => {
    await expect(
      guard.canActivate(createContext({ cookie: '' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // ── Revalidación contra BD ────────────────────────────────────────

  it('revalida el usuario contra BD y setea request.user con datos frescos', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'user-1',
      email: 'fresh@b.com',
      role: 'ADMIN',
      isIdentityVerified: true,
    });

    const context = createContext({ cookie: 'valid-jwt' });
    await guard.canActivate(context);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', isDeleted: false },
      select: {
        id: true,
        email: true,
        role: true,
        isIdentityVerified: true,
      },
    });

    const user = context.switchToHttp().getRequest().user;
    expect(user).toEqual({
      sub: 'user-1',
      email: 'fresh@b.com',
      role: 'ADMIN',
      isIdentityVerified: true,
    });
  });

  it('lanza UnauthorizedException si el usuario fue eliminado (isDeleted=true) en BD', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext({ cookie: 'valid-jwt' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', isDeleted: false },
      select: {
        id: true,
        email: true,
        role: true,
        isIdentityVerified: true,
      },
    });
  });

  it('lanza UnauthorizedException si el usuario no existe en BD', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext({ cookie: 'valid-jwt' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // ── Token inválido ────────────────────────────────────────────────

  it('lanza UnauthorizedException si el token es inválido', async () => {
    mockVerifyAsync.mockRejectedValue(new Error('bad token'));

    await expect(
      guard.canActivate(createContext({ cookie: 'bad-jwt' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lanza UnauthorizedException si el token está expirado', async () => {
    mockVerifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      guard.canActivate(createContext({ cookie: 'expired-jwt' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // ── Anti-PII ──────────────────────────────────────────────────────

  it('NO registra payload ni usuario por consola (sin PII)', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const context = createContext({ cookie: 'valid-jwt' });

    await guard.canActivate(context);

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
