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
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { MercadoPagoService } from './mercadopago.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mercadopagoService: MercadoPagoService,
  ) {}

  @Post(':id/preference')
  createPreference(@Param('id', ParseUUIDPipe) id: string) {
    return this.mercadopagoService.createPreference(id);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(@Body() body: { type: string; data: { id: string } }) {
    return this.mercadopagoService.handleWebhook(body);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.paymentsService.findOne(id, req.user.sub);
  }
}
