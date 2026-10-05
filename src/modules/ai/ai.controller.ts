import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AiRateLimiter } from './ai-rate.limiter';
import { AiService } from './ai.service';
import type { ChatRequestDto } from './dto/chat.dto';

@Public()
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly rateLimiter: AiRateLimiter,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
  ): Promise<{ text: string }> {
    this.rateLimiter.consume(req.ip ?? 'unknown');
    const user = await this.aiService.resolveRequestUser(req);
    return this.aiService.generate(dto, user);
  }

  @Post('chat/stream')
  @HttpCode(200)
  async stream(
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    this.rateLimiter.consume(req.ip ?? 'unknown');
    const user = await this.aiService.resolveRequestUser(req);
    const upstream = await this.aiService.openStream(dto, user);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const reader = upstream.body?.getReader();
    if (!reader) {
      res.end();
      return;
    }

    res.on('close', () => {
      void reader.cancel().catch(() => undefined);
    });

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch {
      res.write(`data: ${JSON.stringify({ error: 'STREAM_INTERRUPTED' })}\n\n`);
      res.end();
    }
  }
}
