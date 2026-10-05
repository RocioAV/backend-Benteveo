import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiRateLimiter } from './ai-rate.limiter';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiRateLimiter],
})
export class AiModule {}
