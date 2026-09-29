import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoConfig,
  Preference,
  Payment,
  PaymentRefund,
} from 'mercadopago';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentNotFoundException,
  PaymentReversalException,
} from '../../common/exceptions/payment-exceptions';
import type { PaymentStatus } from '@prisma/client';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger('MercadoPago');
  private preference: Preference;
  private paymentClient: Payment;
  private refundClient: PaymentRefund;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const client = new MercadoPagoConfig({
      accessToken: this.configService.get<string>('MP_ACCESS_TOKEN') ?? '',
    });
    this.preference = new Preference(client);
    this.paymentClient = new Payment(client);
    this.refundClient = new PaymentRefund(client);
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
      this.logger.warn('Pago no encontrado al crear preferencia', {
        paymentId,
      });
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
        success: `${frontendUrl}/pago-exitoso`,
        failure: `${frontendUrl}/pago-fallido`,
        pending: `${frontendUrl}/pago-pendiente`,
      },
      auto_return: 'approved' as const,
      notification_url: `https://179e-2800-810-599-14d6-bcfd-9c76-7013-3fcc.ngrok-free.app/api/v1/payments/webhook`, //cambiar cuando se deploye
      external_reference: paymentId,
    };

    const response = await this.preference.create({ body: preferenceBody });

    this.logger.log('Preferencia creada', {
      paymentId,
      preferenceId: response.id,
    });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { preferenceId: response.id },
    });

    return {
      init_point: response.init_point,
      preferenceId: response.id,
    };
  }

  /**
   * Revierte un pago ante Mercado Pago y actualiza su estado local.
   *
   * - Pago aprobado → reembolso total (`PaymentRefund.total`) → REFUNDED
   * - Pago pendiente/rechazado con referencia en MP → cancelación → CANCELLED
   * - Pago pendiente sin referencia en MP → solo estado local → CANCELLED
   * - Ya cancelado/reembolsado → no-op (idempotente)
   *
   * Lanza `PaymentReversalException` si Mercado Pago rechaza la operación,
   * para que el llamador no aplique cambios locales.
   */
  async reversePayment(paymentId: string): Promise<PaymentStatus> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    if (payment.status === 'CANCELLED' || payment.status === 'REFUNDED') {
      return payment.status;
    }

    if (payment.status === 'APPROVED') {
      await this.refundApprovedPayment(
        payment.id,
        payment.mercadoPagoPaymentId,
      );
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      });
      this.logger.log('Pago reembolsado', {
        paymentId: payment.id,
        mpPaymentId: payment.mercadoPagoPaymentId,
      });
      return 'REFUNDED';
    }

    if (payment.mercadoPagoPaymentId) {
      await this.cancelMpPayment(payment.id, payment.mercadoPagoPaymentId);
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CANCELLED' },
    });
    this.logger.log('Pago cancelado', {
      paymentId: payment.id,
      mpPaymentId: payment.mercadoPagoPaymentId,
    });
    return 'CANCELLED';
  }

  private async refundApprovedPayment(
    paymentId: string,
    mpPaymentId: string | null,
  ): Promise<void> {
    if (!mpPaymentId) {
      throw new PaymentReversalException(
        paymentId,
        'El pago aprobado no tiene referencia en Mercado Pago',
      );
    }

    try {
      await this.refundClient.total({ payment_id: mpPaymentId });
    } catch (error) {
      const mpStatus = await this.getMpPaymentStatus(mpPaymentId);
      if (mpStatus === 'refunded' || mpStatus === 'partially_refunded') {
        return;
      }
      this.logger.error('Reembolso rechazado por Mercado Pago', {
        paymentId,
        mpPaymentId,
        mpStatus,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new PaymentReversalException(paymentId);
    }
  }

  private async cancelMpPayment(
    paymentId: string,
    mpPaymentId: string,
  ): Promise<void> {
    try {
      await this.paymentClient.cancel({ id: mpPaymentId });
    } catch (error) {
      const mpStatus = await this.getMpPaymentStatus(mpPaymentId);
      if (mpStatus === 'cancelled') {
        return;
      }
      if (mpStatus === 'approved') {
        throw new PaymentReversalException(
          paymentId,
          'El pago ya está aprobado en Mercado Pago; volvé a intentar para reembolsarlo',
        );
      }
      this.logger.error('Cancelación rechazada por Mercado Pago', {
        paymentId,
        mpPaymentId,
        mpStatus,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new PaymentReversalException(paymentId);
    }
  }

  private async getMpPaymentStatus(
    mpPaymentId: string,
  ): Promise<string | undefined> {
    try {
      const mpPayment = await this.paymentClient.get({ id: mpPaymentId });
      return mpPayment.status;
    } catch {
      return undefined;
    }
  }

  async handleWebhook(body: {
    type?: string;
    data?: { id?: string };
    resource?: string;
    topic?: string;
  }) {
    this.logger.log('Webhook recibido', {
      type: body.type,
      mpPaymentId: body.data?.id,
    });

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

    await this.applyMpPayment(payment, mpPayment);

    return { received: true };
  }

  /**
   * Sincroniza un pago local con su estado real en Mercado Pago.
   *
   * No depende del webhook: busca el pago por `mercadoPagoPaymentId` o por
   * `external_reference` y aplica la misma lógica que el webhook (si estaba
   * aprobado, la reserva pasa a CONFIRMED). Pensado para el retorno desde
   * Mercado Pago cuando la notificación no llegó.
   */
  async syncPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new PaymentNotFoundException(paymentId);
    }

    if (payment.status !== 'REFUNDED' && payment.status !== 'CANCELLED') {
      const mpPayment = await this.fetchMpPayment(payment);
      if (mpPayment) {
        await this.applyMpPayment(payment, mpPayment);
      } else {
        this.logger.warn(
          'No se encontró el pago en Mercado Pago al sincronizar',
          {
            paymentId: payment.id,
            mpPaymentId: payment.mercadoPagoPaymentId,
          },
        );
      }
    }

    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { reservation: true },
    });
  }

  private async fetchMpPayment(payment: {
    id: string;
    mercadoPagoPaymentId: string | null;
  }): Promise<Awaited<ReturnType<Payment['get']>> | undefined> {
    if (payment.mercadoPagoPaymentId) {
      try {
        return await this.paymentClient.get({
          id: payment.mercadoPagoPaymentId,
        });
      } catch {
        // fallback: búsqueda por external_reference
      }
    }

    try {
      const search = await this.paymentClient.search({
        options: { external_reference: payment.id },
      });
      const found = search.results?.[0];
      if (found?.id) {
        return await this.paymentClient.get({ id: found.id });
      }
    } catch {
      // mejor esfuerzo: el webhook sigue siendo la vía principal
    }

    return undefined;
  }

  /**
   * Aplica el estado de un pago de Mercado Pago al pago local y dispara los
   * efectos sobre la reserva (aprobar → CONFIRMED, revertir → CANCELLED).
   * Compartido por el webhook y por `syncPayment`.
   */
  private async applyMpPayment(
    payment: { id: string; status: PaymentStatus; reservationId: string },
    mpPayment: Awaited<ReturnType<Payment['get']>>,
  ): Promise<PaymentStatus> {
    const paymentId = payment.id;

    const statusMap: Record<string, PaymentStatus> = {
      approved: 'APPROVED',
      rejected: 'REJECTED',
      cancelled: 'CANCELLED',
      refunded: 'REFUNDED',
      pending: 'PENDING',
    };

    const newStatus: PaymentStatus =
      statusMap[mpPayment.status ?? ''] ?? 'PENDING';

    if (
      (payment.status === 'REFUNDED' || payment.status === 'CANCELLED') &&
      newStatus !== payment.status
    ) {
      this.logger.log('Evento obsoleto ignorado', {
        paymentId,
        localStatus: payment.status,
        newStatus,
      });
      return payment.status;
    }

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
      const confirmed = await this.prisma.reservation.updateMany({
        where: { id: payment.reservationId, status: 'PENDING' },
        data: {
          status: 'CONFIRMED',
          paymentReceivedAt: new Date(),
        },
      });

      if (confirmed.count === 0) {
        const reservation = await this.prisma.reservation.findUnique({
          where: { id: payment.reservationId },
          select: { status: true },
        });

        if (reservation?.status === 'CANCELLED') {
          this.logger.warn(
            'Pago aprobado para reserva cancelada, se reembolsa automáticamente',
            { paymentId, reservationId: payment.reservationId },
          );
          await this.reversePayment(paymentId);
        }
      }
    } else if (newStatus === 'REFUNDED' || newStatus === 'CANCELLED') {
      this.logger.log('Pago revertido, cancelando reserva', {
        paymentId,
        reservationId: payment.reservationId,
        newStatus,
      });
      await this.prisma.reservation.updateMany({
        where: {
          id: payment.reservationId,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        data: {
          status: 'CANCELLED',
          cancellationConfirmedAt: new Date(),
        },
      });
    }

    return newStatus;
  }
}
