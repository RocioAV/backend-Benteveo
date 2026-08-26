import { ExecutionContext } from '@nestjs/common';
import { getCurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from '../types/user.types';

function createContext(user?: AuthenticatedUser) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('getCurrentUser (CurrentUser decorator factory)', () => {
  const fakeUser: AuthenticatedUser = {
    sub: 'uuid-1',
    email: 'test@test.com',
    role: 'ADMIN',
    isIdentityVerified: true,
  };

  it('devuelve el usuario completo cuando no se pasa data', () => {
    const result = getCurrentUser(undefined, createContext(fakeUser));
    expect(result).toEqual(fakeUser);
  });

  it('devuelve un campo específico cuando se pasa la clave', () => {
    const result = getCurrentUser('sub', createContext(fakeUser));
    expect(result).toBe('uuid-1');
  });

  it('devuelve el role del usuario', () => {
    const result = getCurrentUser('role', createContext(fakeUser));
    expect(result).toBe('ADMIN');
  });

  it('devuelve isIdentityVerified del usuario', () => {
    const result = getCurrentUser(
      'isIdentityVerified',
      createContext(fakeUser),
    );
    expect(result).toBe(true);
  });

  it('devuelve undefined cuando no hay usuario en la request', () => {
    const result = getCurrentUser(undefined, createContext(undefined));
    expect(result).toBeUndefined();
  });

  it('devuelve undefined al pedir un campo cuando no hay usuario', () => {
    const result = getCurrentUser('email', createContext(undefined));
    expect(result).toBeUndefined();
  });

  it('devuelve undefined al pedir un campo inexistente', () => {
    const result = getCurrentUser(
      'nonExistent' as keyof AuthenticatedUser,
      createContext(fakeUser),
    );
    expect(result).toBeUndefined();
  });
});
