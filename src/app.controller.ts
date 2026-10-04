import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check público (200 sin auth) para el `healthCheckPath` de Render.
   * `GET /api/v1` sigue protegido por el AuthGuard global.
   */
  @Public()
  @Get('health')
  health(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
