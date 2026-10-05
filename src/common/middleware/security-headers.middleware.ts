import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Headers de seguridad de respuesta (alternativa liviana a helmet, sin
 * dependencias nuevas): evita sniffing, clickjacking y filtra el referrer.
 * HSTS se envía solo cuando la conexión entrante es HTTPS (Render termina TLS
 * con X-Forwarded-Proto).
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (req.secure) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  }
}
