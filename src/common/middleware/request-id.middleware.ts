import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Middleware global idempotente de requestId.
 *
 * Adopta el `X-Request-Id` entrante si viene, o genera un uuid v4 si no.
 * Refleja el id en el header de respuesta y lo deja disponible en el request
 * para que el `HttpExceptionFilter` lo propague al body de error. Sin PII.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming
        : randomUUID();

    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
