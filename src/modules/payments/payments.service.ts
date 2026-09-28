import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentNotFoundException } from '../../common/exceptions/payment-exceptions';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadopagoService: MercadoPagoService,
  ) {}

  async findOne(id: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        reservation: {
          include: { product: true },
        },
      },
    });

    if (!payment) {
      throw new PaymentNotFoundException(id);
    }

    if (payment.reservation.userId !== userId) {
      throw new ForbiddenException('No tenés permiso para ver este pago');
    }

    return payment;
  }

  /**
   * Sincroniza el pago con Mercado Pago (estado + efectos sobre la reserva)
   * tras el retorno del checkout. Usa la misma verificación de permisos que
   * `findOne`: solo el renter de la reserva.
   */
  async sync(id: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { reservation: { select: { userId: true } } },
    });

    if (!payment) {
      throw new PaymentNotFoundException(id);
    }

    if (payment.reservation.userId !== userId) {
      throw new ForbiddenException('No tenés permiso para sincronizar este pago');
    }

    return this.mercadopagoService.syncPayment(id);
  }
}
