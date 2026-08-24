import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';

function createContext(authHeader?: string) {
  const request = { headers: { authorization: authHeader } };
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

  const mockJwtService = {
    verifyAsync: mockVerifyAsync,
  } as unknown as JwtService;

  const mockConfigService = {
    get: mockConfigGet,
  } as unknown as ConfigService;

  const mockReflector = {
    getAllAndOverride: mockGetAllAndOverride,
  } as unknown as Reflector;

  const guard = new AuthGuard(mockJwtService, mockConfigService, mockReflector);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAndOverride.mockReturnValue(false);
    mockConfigGet.mockReturnValue('jwt-secret');
    mockVerifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'a@b.com',
      role: 'USER',
    });
  });

  it('permite el paso en rutas públicas sin verificar token', async () => {
    mockGetAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(mockVerifyAsync).not.toHaveBeenCalled();
  });

  it('valida el token y asigna request.user al payload', async () => {
    const context = createContext('Bearer token-valido');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(mockVerifyAsync).toHaveBeenCalledWith('token-valido', {
      secret: 'jwt-secret',
    });
    expect(context.switchToHttp().getRequest().user).toEqual({
      sub: 'user-1',
      email: 'a@b.com',
      role: 'USER',
    });
  });

  it('NO registra el payload ni el usuario por consola (sin PII)', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const context = createContext('Bearer token-valido');

    await guard.canActivate(context);

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('lanza UnauthorizedException si no hay token', async () => {
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockVerifyAsync).not.toHaveBeenCalled();
  });

  it('lanza UnauthorizedException si el token es inválido', async () => {
    mockVerifyAsync.mockRejectedValue(new Error('bad token'));

    await expect(
      guard.canActivate(createContext('Bearer token-malo')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
