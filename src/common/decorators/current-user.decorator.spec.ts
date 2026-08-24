import { ExecutionContext } from '@nestjs/common';
import { getCurrentUser } from './current-user.decorator';

describe('CurrentUser decorator', () => {
  const user = { sub: 'user-1', email: 'juan@example.com', role: 'USER' };

  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;

  it('devuelve el usuario completo cuando no se pasa clave', () => {
    expect(getCurrentUser(undefined, ctx)).toBe(user);
  });

  it('devuelve el campo pedido (sub) cuando se pasa la clave', () => {
    expect(getCurrentUser('sub', ctx)).toBe('user-1');
  });

  it('devuelve undefined si no hay usuario en el request', () => {
    const emptyCtx = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    expect(getCurrentUser(undefined, emptyCtx)).toBeUndefined();
  });
});
