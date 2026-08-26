import { ForbiddenException } from '@nestjs/common';
import { KycGuard } from './kyc.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

function createContext(user?: {
  sub: string;
  isIdentityVerified?: boolean;
  [key: string]: unknown;
}) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('KycGuard', () => {
  const mockGetAllAndOverride = jest.fn();
  const mockReflector = {
    getAllAndOverride: mockGetAllAndOverride,
  } as unknown as Reflector;

  const guard = new KycGuard(mockReflector);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite el paso cuando isIdentityVerified es true', () => {
    mockGetAllAndOverride.mockReturnValue(true);

    const context = createContext({
      sub: 'user-1',
      isIdentityVerified: true,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('lanza ForbiddenException con code AUTH_KYC_REQUIRED cuando isIdentityVerified es false', () => {
    mockGetAllAndOverride.mockReturnValue(true);

    const context = createContext({
      sub: 'user-1',
      isIdentityVerified: false,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

    try {
      guard.canActivate(context);
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toEqual({
        code: ErrorCode.AUTH_KYC_REQUIRED,
        message: 'Se requiere verificación de identidad (KYC)',
        fields: null,
      });
    }
  });

  it('lanza ForbiddenException cuando el usuario no tiene isIdentityVerified definido', () => {
    mockGetAllAndOverride.mockReturnValue(true);

    const context = createContext({
      sub: 'user-1',
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza ForbiddenException cuando no hay usuario en la request', () => {
    mockGetAllAndOverride.mockReturnValue(true);

    const context = createContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permite el paso cuando el handler no tiene @KycRequired()', () => {
    mockGetAllAndOverride.mockReturnValue(false);

    const context = createContext({
      sub: 'user-1',
      isIdentityVerified: false,
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
