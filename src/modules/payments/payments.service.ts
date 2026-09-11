import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentNotFoundException } from '../../common/exceptions/payment-exceptions';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
