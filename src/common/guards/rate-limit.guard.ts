import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_BUCKETS = 10_000;

function sweep(now: number): void {
  if (buckets.size < MAX_TRACKED_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Rate limiter en memoria (ventana fija) por ruta + IP. No requiere
 * dependencias ni store externo: suficiente para una instancia única
 * (Render free tier corre un solo proceso).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!options) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const key = `${context.getClass().name}:${context.getHandler().name}:${ip}`;
    const now = Date.now();

    sweep(now);

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      throw new HttpException(
        `Demasiados intentos. Probá de nuevo en ${retryAfter} segundos`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
