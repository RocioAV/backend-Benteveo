import { CsrfGuard, safeStringEqual } from './csrf.guard';
import { CsrfTokenInvalidException } from '../exceptions/auth-exceptions';
import { ErrorCode } from '../constants/error-codes';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../constants/cookies';
import type { Reflector } from '@nestjs/core';

describe('CsrfGuard', () => {
  const mockGetAllAndOverride = jest.fn<boolean, [any, any]>();
  const mockReflector = {
    getAllAndOverride: mockGetAllAndOverride,
  } as unknown as Reflector;

  const guard = new CsrfGuard(mockReflector);
  const csrf = 'nonce-123';

  function createContext(overrides: Record<string, unknown> = {}) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          headers: {},
          cookies: {},
          user: { csrf },
          ...overrides,
        }),
      }),
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAndOverride.mockReturnValue(false);
  });

  it('permite métodos safe (GET) sin validar CSRF ni consultar reflector', () => {
    const ctx = createContext({ method: 'GET' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(mockGetAllAndOverride).not.toHaveBeenCalled();
  });

  it('permite rutas públicas aunque sean unsafe (login/register/logout)', () => {
    mockGetAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('permite escritura con header === cookie === claim (double-submit válido)', () => {
    const ctx = createContext({
      headers: { [CSRF_HEADER_NAME]: csrf },
      cookies: { [CSRF_COOKIE_NAME]: csrf },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rechaza escritura sin header CSRF', () => {
    const ctx = createContext({ cookies: { [CSRF_COOKIE_NAME]: csrf } });

    expect(() => guard.canActivate(ctx)).toThrow(CsrfTokenInvalidException);
  });

  it('rechaza escritura con header distinto a la cookie', () => {
    const ctx = createContext({
      headers: { [CSRF_HEADER_NAME]: 'otro-token' },
      cookies: { [CSRF_COOKIE_NAME]: csrf },
    });

    expect(() => guard.canActivate(ctx)).toThrow(CsrfTokenInvalidException);
  });

  it('rechaza escritura con header/cookie correctos pero claim JWT distinto', () => {
    const ctx = createContext({
      headers: { [CSRF_HEADER_NAME]: csrf },
      cookies: { [CSRF_COOKIE_NAME]: csrf },
      user: { csrf: 'claim-distinto' },
    });

    expect(() => guard.canActivate(ctx)).toThrow(CsrfTokenInvalidException);
  });

  it('lanza 403 con code CSRF_TOKEN_INVALID', () => {
    let caught: CsrfTokenInvalidException | undefined;
    try {
      guard.canActivate(createContext({}));
    } catch (error) {
      caught = error as CsrfTokenInvalidException;
    }

    expect(caught).toBeDefined();
    expect(caught!.getStatus()).toBe(403);
    expect(caught!.code).toBe(ErrorCode.CSRF_TOKEN_INVALID);
  });
});

describe('safeStringEqual (timing-safe)', () => {
  it('retorna true para strings iguales', () => {
    expect(safeStringEqual('abc', 'abc')).toBe(true);
  });

  it('retorna false para strings distintas de igual longitud', () => {
    expect(safeStringEqual('abc', 'abd')).toBe(false);
  });

  it('retorna false para strings de distinta longitud', () => {
    expect(safeStringEqual('abc', 'abcd')).toBe(false);
  });
});
