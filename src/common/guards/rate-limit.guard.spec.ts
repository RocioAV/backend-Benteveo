import 'reflect-metadata';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';

function makeContext(handler: () => void, className: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => ({ name: className }) as never,
    switchToHttp: () => ({
      getRequest: () => ({ ip: '10.0.0.1' }),
    }),
  } as unknown as ExecutionContext;
}

function withRateLimit(
  handler: () => void,
  options: RateLimitOptions,
): () => void {
  Reflect.defineMetadata(RATE_LIMIT_KEY, options, handler);
  return handler;
}

describe('RateLimitGuard', () => {
  const guard = new RateLimitGuard(new Reflector());

  it('permite requests sin metadata de rate limit', () => {
    const handler = () => undefined;
    expect(guard.canActivate(makeContext(handler, 'NoLimitController'))).toBe(
      true,
    );
  });

  it('permite hasta el máximo y responde 429 al excederlo', () => {
    const handler = withRateLimit(() => undefined, {
      max: 3,
      windowMs: 60_000,
    });
    const ctx = makeContext(handler, 'LimitedController');

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);

    let thrown: unknown;
    try {
      guard.canActivate(ctx);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
  });

  it('deja pasar de nuevo cuando la ventana expira', () => {
    const handler = withRateLimit(() => undefined, {
      max: 1,
      windowMs: 60_000,
    });
    const ctx = makeContext(handler, 'ExpiringController');

    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);
    expect(guard.canActivate(ctx)).toBe(true);
    jest.restoreAllMocks();
  });
});
