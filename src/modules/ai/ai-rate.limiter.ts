import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';

const WINDOW_MS = 60_000;
const MAX_HITS = 15;
const MAX_KEYS = 5000;

@Injectable()
export class AiRateLimiter {
  private readonly hits = new Map<string, number[]>();

  consume(key: string): void {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );

    if (recent.length >= MAX_HITS) {
      this.hits.set(key, recent);
      throw new AppException(
        ErrorCode.RATE_LIMITED,
        'Demasiadas consultas al asistente. Esperá un minuto y volvé a intentar.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(key, recent);

    if (this.hits.size > MAX_KEYS) {
      this.purge(now);
    }
  }

  private purge(now: number): void {
    for (const [key, timestamps] of this.hits) {
      if (timestamps.every((t) => now - t >= WINDOW_MS)) {
        this.hits.delete(key);
      }
    }
  }
}
