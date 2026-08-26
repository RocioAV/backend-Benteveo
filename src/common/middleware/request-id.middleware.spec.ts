import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  function createMocks(headers: Record<string, unknown> = {}) {
    const req = { headers } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();
    return { req, res, next };
  }

  it('adopta el X-Request-Id entrante (idempotente)', () => {
    const { req, res, next } = createMocks({ 'x-request-id': 'req-incoming-1' });

    middleware.use(req, res, next);

    expect(req.headers['x-request-id']).toBe('req-incoming-1');
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      'req-incoming-1',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('genera un uuid si no hay header entrante', () => {
    const { req, res, next } = createMocks({});

    middleware.use(req, res, next);

    expect(req.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
    );
  });

  it('no loguea la URL ni datos de la petición (sin PII)', () => {
    const { req, res, next } = createMocks({});
    const logSpy = jest.spyOn(console, 'log').mockImplementation();

    middleware.use(req, res, next);

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
