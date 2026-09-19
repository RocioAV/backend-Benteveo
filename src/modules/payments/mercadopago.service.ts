import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentNotFoundException } from '../../common/exceptions/payment-exceptions';
import type { PaymentStatus } from '@prisma/client';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger('MercadoPago');
  private preference: Preference;
  private paymentClient: Payment;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MP_ACCESS_TOKEN') ?? '',
    });
    this.preference = new Preference(client);
    this.paymentClient = new Payment(client);
  }

  async createPreference(paymentId: string) {
    this.logger.log('Creando preferencia MercadoPago', { paymentId });

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        reservation: {
          include: { product: true },
        },
      },
    });

    if (!payment) {
      this.logger.warn('Pago no encontrado al crear preferencia', { paymentId });
      throw new PaymentNotFoundException(paymentId);
    }

    const product = payment.reservation.product;
    // const frontendUrl = this.configService.get<string>('FRONTEND_URL_DEPLOY '); //debemos desplegar el forntend
    // const backendUrl = this.configService.get<string>('BACKEND_URL_DEPLOY');
    const frontendUrl = 'https://localhost:5173';
    const preferenceBody = {
      items: [
        {
          id: payment.reservation.productId,
          title: product.title,
          quantity: 1,
          unit_price: payment.amount.toNumber(),
          currency_id: 'ARS',
        },
      ],
      back_urls: {
        success: `${frontendUrl}/dashboard`,
        failure: `${frontendUrl}/pago-fallido`,
        pending: `${frontendUrl}/pago-pendiente`,
      },
      auto_return: 'approved' as const,
      notification_url: `https://ba36-2800-810-599-14d6-d173-65f0-ca97-a2ec.ngrok-free.app/api/v1/payments/webhook`, //cambiar cuando se deploye
      external_reference: paymentId,
    };

    const response = await this.preference.create({ body: preferenceBody });

    this.logger.log('Preferencia creada', { paymentId, preferenceId: response.id });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { preferenceId: response.id },
    });

    return {
      init_point: response.init_point,
      preferenceId: response.id,
    };
  }

  async handleWebhook(body: {
    type?: string;
    data?: { id?: string };
    resource?: string;
    topic?: string;
  }) {
    this.logger.log('Webhook recibido', { type: body.type, mpPaymentId: body.data?.id });

    if (body.type !== 'payment') {
      return { received: true };
    }

    const mpPaymentId = body.data?.id;
    if (!mpPaymentId) {
      return { received: true };
    }

    let mpPayment: Awaited<ReturnType<Payment['get']>>;
    try {
      mpPayment = await this.paymentClient.get({ id: mpPaymentId });
    } catch {
      return { received: true };
    }

    const paymentId = mpPayment.external_reference;
    if (!paymentId) {
      return { received: true };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { received: true };
    }

    const statusMap: Record<string, PaymentStatus> = {
      approved: 'APPROVED',
      rejected: 'REJECTED',
      cancelled: 'CANCELLED',
      refunded: 'REFUNDED',
      pending: 'PENDING',
    };

    const newStatus: PaymentStatus =
      statusMap[mpPayment.status ?? ''] ?? 'PENDING';

    this.logger.log('Estado de pago actualizado', { paymentId, newStatus });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: newStatus,
        mercadoPagoPaymentId: mpPayment.id?.toString(),
        paymentMethod: mpPayment.payment_method_id,
        paymentTypeId: mpPayment.payment_type_id,
      },
    });

    if (newStatus === 'APPROVED') {
      this.logger.log('Pago aprobado, confirmando reserva', { paymentId, reservationId: payment.reservationId });
      await this.prisma.reservation.update({
        where: { id: payment.reservationId },
        data: {
          status: 'CONFIRMED',
          paymentReceivedAt: new Date(),
        },
      });
    }

    return { received: true };
  }
}
