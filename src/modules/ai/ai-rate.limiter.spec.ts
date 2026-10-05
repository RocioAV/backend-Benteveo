import { AiRateLimiter } from './ai-rate.limiter';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

describe('AiRateLimiter', () => {
  let limiter: AiRateLimiter;
  let now: number;
  let dateSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    limiter = new AiRateLimiter();
    now = 1_000_000;
    dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('permite hasta 15 consultas por ventana', () => {
    for (let i = 0; i < 15; i++) {
      expect(() => limiter.consume('ip-1')).not.toThrow();
    }
    expect(() => limiter.consume('ip-1')).toThrow(AppException);
  });

  it('lanza RATE_LIMITED con status 429 al exceder el límite', () => {
    for (let i = 0; i < 15; i++) {
      limiter.consume('ip-1');
    }

    let caught: unknown;
    try {
      limiter.consume('ip-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppException);
    expect((caught as AppException).code).toBe(ErrorCode.RATE_LIMITED);
    expect((caught as AppException).getStatus()).toBe(429);
  });

  it('la ventana se libera después de 60 segundos', () => {
    for (let i = 0; i < 15; i++) {
      limiter.consume('ip-1');
    }
    expect(() => limiter.consume('ip-1')).toThrow();

    now += 60_001;
    expect(() => limiter.consume('ip-1')).not.toThrow();
  });

  it('contabiliza por clave de forma independiente', () => {
    for (let i = 0; i < 15; i++) {
      limiter.consume('ip-1');
    }
    expect(() => limiter.consume('ip-1')).toThrow();
    expect(() => limiter.consume('ip-2')).not.toThrow();
  });
});
