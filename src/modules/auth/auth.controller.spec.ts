import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  COOKIE_PATH,
} from '../../common/constants/cookies';
import type { Request, Response } from 'express';

function makeRes() {
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
  return res;
}

describe('AuthController', () => {
  const mockSignIn = jest.fn<Promise<any>, [string, string]>();
  const mockSignUp = jest.fn<Promise<any>, [any]>();
  const mockAuthService = {
    signIn: mockSignIn,
    signUp: mockSignUp,
  } as unknown as AuthService;

  const controller = new AuthController(mockAuthService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    it('setea la cookie de sesión HttpOnly y la cookie CSRF no-HttpOnly con flags correctos', async () => {
      mockSignIn.mockResolvedValue({
        accessToken: 'jwt-token',
        csrfToken: 'csrf-nonce',
        maxAgeMs: 3600000,
        secure: false,
      });

      const res = makeRes();

      await controller.signIn(
        { email: 'juan@example.com', password: 'password123' },
        res,
      );

      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(res.cookie).toHaveBeenNthCalledWith(1, SESSION_COOKIE_NAME, 'jwt-token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: COOKIE_PATH,
        maxAge: 3600000,
      });
      expect(res.cookie).toHaveBeenNthCalledWith(2, CSRF_COOKIE_NAME, 'csrf-nonce', {
        httpOnly: false,
        sameSite: 'lax',
        secure: false,
        path: COOKIE_PATH,
        maxAge: 3600000,
      });
    });

    it('NO devuelve el token en el body (respuesta 204 vacía)', async () => {
      mockSignIn.mockResolvedValue({
        accessToken: 'jwt-token',
        csrfToken: 'csrf-nonce',
        maxAgeMs: 3600000,
        secure: false,
      });

      const res = makeRes();

      const body = await controller.signIn(
        { email: 'juan@example.com', password: 'password123' },
        res,
      );

      expect(body).toBeUndefined();
    });

    it('pasa el flag secure al cookie de sesión (true en producción)', async () => {
      mockSignIn.mockResolvedValue({
        accessToken: 'jwt-token',
        csrfToken: 'csrf-nonce',
        maxAgeMs: 3600000,
        secure: true,
      });

      const res = makeRes();

      await controller.signIn(
        { email: 'juan@example.com', password: 'password123' },
        res,
      );

      expect(res.cookie).toHaveBeenNthCalledWith(1, SESSION_COOKIE_NAME, 'jwt-token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: COOKIE_PATH,
        maxAge: 3600000,
      });
    });
  });

  describe('logout', () => {
    it('limpia ambas cookies (sesión y csrf)', async () => {
      const res = makeRes();

      await controller.logout({ cookies: {} } as unknown as Request, res);

      expect(res.clearCookie).toHaveBeenCalledTimes(2);
      expect(res.clearCookie).toHaveBeenCalledWith(
        SESSION_COOKIE_NAME,
        expect.objectContaining({ path: COOKIE_PATH }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        expect.objectContaining({ path: COOKIE_PATH }),
      );
    });
  });

  describe('getCsrfToken', () => {
    it('devuelve el token CSRF presente en la cookie', () => {
      const req = {
        cookies: { [CSRF_COOKIE_NAME]: 'csrf-nonce' },
      } as unknown as Request;

      expect(controller.getCsrfToken(req)).toEqual({ csrfToken: 'csrf-nonce' });
    });

    it('devuelve null si no hay cookie CSRF', () => {
      const req = { cookies: {} } as unknown as Request;

      expect(controller.getCsrfToken(req)).toEqual({ csrfToken: null });
    });
  });
});
