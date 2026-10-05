import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { MercadoPagoService } from './mercadopago.service';
import { Public } from '../../common/decorators/public.decorator';
import { isValidWebhookSignature } from './webhook-signature';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mercadopagoService: MercadoPagoService,
    private readonly configService: ConfigService,
  ) {}

  @Post(':id/preference')
  async createPreference(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    await this.paymentsService.findOne(id, req.user.sub);
    return this.mercadopagoService.createPreference(id);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Req() req: Request,
    @Body() body: { type?: string; data?: { id?: string } },
  ) {
    const headers = req.headers as Record<string, string | undefined>;
    const query = req.query as Record<string, unknown>;
    const queryDataId = query['data.id'];
    const dataId =
      typeof queryDataId === 'string' ? queryDataId : body?.data?.id;

    const secret = this.configService.get<string>('MP_WEBHOOK_SECRET');
    if (secret) {
      const valid = isValidWebhookSignature(
        {
          signatureHeader: headers['x-signature'],
          requestId: headers['x-request-id'] ?? '',
          dataId,
        },
        secret,
      );
      if (!valid) {
        throw new UnauthorizedException('Firma de webhook inválida');
      }
    }

    if (typeof body?.type !== 'string') {
      return { received: true };
    }

    return this.mercadopagoService.handleWebhook(body);
  }

  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  sync(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    return this.paymentsService.sync(id, req.user.sub);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request & { user: { sub: string } },
  ) {
    return this.paymentsService.findOne(id, req.user.sub);
  }
}
