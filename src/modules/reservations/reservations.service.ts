import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { FindReservationsDto } from './dto/find-reservations.dto';
import {
  ReservationNotFoundException,
  ReservationConflictException,
  ProductNotFoundException,
  ProductNotAvailableException,
  InvalidReservationDatesException,
  ReservationAlreadyCancelledException,
  InvalidReservationStatusException,
  ForbiddenReservationException,
} from '../../common/exceptions/reservation-exceptions';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/types/user.types';
import { MercadoPagoService } from '../payments/mercadopago.service';

/**
 * Campos seguros del usuario que se incluyen en las respuestas de reservas.
 * Nunca se expone `password`, `email`, `dni` ni `phone`.
 */
const SAFE_USER_SELECT = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  name: true,
  isIdentityVerified: true,
  profile: { select: { avatar: true } },
});

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger('Reservations');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPago: MercadoPagoService,
  ) {}

  async create(dto: CreateReservationDto, userId: string) {
    this.logger.log('Creando reserva', { productId: dto.productId, userId });

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, isDeleted: false },
    });

    if (!product) {
      throw new ProductNotFoundException(dto.productId);
    }

    if (product.ownerId === userId) {
      throw new ForbiddenException('No puedes reservar tu propio producto');
    }

    if (!product.isAvailable) {
      throw new ProductNotAvailableException(dto.productId);
    }

    const dateInit = new Date(dto.dateInit);
    const dateEnd = new Date(dto.dateEnd);

    // Extraer solo la porción de fecha (sin hora) para comparaciones
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const initDate = new Date(
      dateInit.getFullYear(),
      dateInit.getMonth(),
      dateInit.getDate(),
    );
    const endDate = new Date(
      dateEnd.getFullYear(),
      dateEnd.getMonth(),
      dateEnd.getDate(),
    );

    // La fecha fin debe ser posterior a la fecha inicio (misma fecha no permitida)
    if (endDate <= initDate) {
      throw new InvalidReservationDatesException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
    }

    // La fecha inicio no puede ser en el pasado
    if (initDate < today) {
      throw new InvalidReservationDatesException(
        'La fecha de inicio no puede ser anterior a la fecha actual',
      );
    }

    // Si es el mismo día, debe ser antes de las 20:00
    if (initDate.getTime() === today.getTime() && now.getHours() >= 20) {
      throw new InvalidReservationDatesException(
        'No se pueden hacer reservas para el mismo día después de las 20:00',
      );
    }

    // Calcular monto total: priceDay × días + depósito
    const days = Math.ceil(
      (dateEnd.getTime() - dateInit.getTime()) / 86_400_000,
    );
    const totalAmount =
      product.priceDay.toNumber() * days + product.deposit.toNumber();
    // Transacción serializable: check + create atómicos
    return this.prisma.$transaction(
      async (tx) => {
        const conflict = await tx.reservation.findFirst({
          where: {
            productId: dto.productId,
            status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
            dateInit: { lt: dateEnd },
            dateEnd: { gt: dateInit },
          },
        });

        if (conflict) {
          throw new ReservationConflictException(
            'Las fechas solicitadas se superponen con otra reserva existente',
          );
        }

        const reservation = await tx.reservation.create({
          data: {
            dateInit,
            dateEnd,
            status: 'PENDING',
            productId: dto.productId,
            userId,
            totalAmount,
          },
          include: {
            product: { include: { photos: true } },
            user: { select: SAFE_USER_SELECT },
          },
        });

        const payment = await tx.payment.create({
          data: {
            reservationId: reservation.id,
            amount: totalAmount,
            status: 'PENDING',
          },
        });

        this.logger.log('Reserva y pago creados', {
          reservationId: reservation.id,
          paymentId: payment.id,
          productId: dto.productId,
          userId,
          totalAmount,
        });

        return { reservation, payment };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async findAll(filters: FindReservationsDto) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.status) where.status = filters.status;

    if (filters.dateFrom || filters.dateTo) {
      where.dateInit = {};
      if (filters.dateFrom) where.dateInit.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.dateInit.lte = new Date(filters.dateTo);
    }

    return this.prisma.reservation.findMany({
      where,
      include: {
        product: { include: { photos: true } },
        user: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyReservations(userId: string) {
    return this.prisma.reservation.findMany({
      where: { userId },
      include: {
        product: { include: { photos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAsOwner(userId: string) {
    return this.prisma.reservation.findMany({
      where: {
        product: {
          ownerId: userId,
        },
      },
      include: {
        product: { include: { photos: true } },
        user: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const reservation = await this.getReservationOrThrow(id);

    const isRenter = reservation.userId === user.sub;
    const isOwner = reservation.product.ownerId === user.sub;
    const isAdmin = user.role === Role.ADMIN;

    if (!isRenter && !isOwner && !isAdmin) {
      throw new ForbiddenReservationException(
        'No tenés permiso para ver esta reserva',
      );
    }

    return reservation;
  }

  async cancel(id: string, userId: string, userRole?: Role) {
    const reservation = await this.getReservationOrThrow(id);

    const isOwner = reservation.product.ownerId === userId;
    const isRenter = reservation.userId === userId;
    const isAdmin = userRole === Role.ADMIN;

    if (!isOwner && !isRenter && !isAdmin) {
      throw new ForbiddenReservationException(
        'No tenés permiso para cancelar esta reserva',
      );
    }

    if (reservation.status === 'CANCELLED') {
      throw new ReservationAlreadyCancelledException(id);
    }

    if (reservation.status === 'COMPLETED') {
      throw new InvalidReservationStatusException(
        'No se puede cancelar una reserva ya completada',
      );
    }

    this.logger.log('Cancelando reserva', { reservationId: id, userId });

    const payment = await this.prisma.payment.findUnique({
      where: { reservationId: id },
    });

    let paymentStatus: PaymentStatus | null = null;

    if (payment) {
      // Reembolso simulado: si Mercado Pago rechaza la reversión (esperado en
      // este entorno) se ignora y la reserva se cancela igualmente. El
      // reembolso se informa desde el frontend con una secuencia de toasts.
      try {
        paymentStatus = await this.mercadoPago.reversePayment(payment.id);
      } catch (error) {
        this.logger.warn(
          'Reversión de pago fallida — se ignora y la reserva se cancela igual',
          {
            reservationId: id,
            paymentId: payment.id,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    const cancelledReservation = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationConfirmedAt: new Date(),
      },
      include: {
        product: { include: { photos: true } },
        user: { select: SAFE_USER_SELECT },
        payment: true,
      },
    });

    this.logger.log('Reserva cancelada', {
      reservationId: id,
      paymentId: payment?.id,
      paymentStatus,
    });

    return cancelledReservation;
  }

  /**
   * El dueño marca la entrega. Registra `actualHandoffAt` y la reserva
   * permanece en CONFIRMED hasta que el inquilino confirme la recepción.
   * Idempotente: si el dueño ya marcó la entrega, devuelve la reserva actual.
   */
  async handoff(id: string, ownerId: string, notes?: string) {
    const reservation = await this.getReservationOrThrow(id);

    if (reservation.product.ownerId !== ownerId) {
      throw new ForbiddenReservationException(
        'No tenés permiso para entregar esta reserva',
      );
    }

    if (reservation.actualHandoffAt) {
      return reservation;
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new InvalidReservationStatusException(
        'Solo se pueden entregar reservas en estado CONFIRMED',
      );
    }

    this.logger.log('Dueño marca entrega', {
      reservationId: id,
      ownerId,
    });

    // Update condicional: evita doble transición concurrente.
    const updated = await this.prisma.reservation.updateMany({
      where: { id, status: 'CONFIRMED', actualHandoffAt: null },
      data: {
        actualHandoffAt: new Date(),
        handoffNotes: notes,
      },
    });

    if (updated.count === 0) {
      const current = await this.getReservationOrThrow(id);
      if (current.actualHandoffAt) {
        return current;
      }
      throw new InvalidReservationStatusException(
        'Solo se pueden entregar reservas en estado CONFIRMED',
      );
    }

    return this.getReservationOrThrow(id);
  }

  /**
   * El inquilino confirma la recepción. Exige que el dueño haya marcado la
   * entrega y recién entonces cambia la reserva a ACTIVE.
   * Idempotente: si ya confirmó, devuelve la reserva actual.
   */
  async confirmHandoffReceipt(id: string, renterId: string) {
    const reservation = await this.getReservationOrThrow(id);

    if (reservation.userId !== renterId) {
      throw new ForbiddenReservationException(
        'No tenés permiso para confirmar la recepción de esta reserva',
      );
    }

    if (reservation.renterReceivedAt) {
      return reservation;
    }

    if (!reservation.actualHandoffAt) {
      throw new InvalidReservationStatusException(
        'El dueño debe marcar la entrega antes de confirmar la recepción',
      );
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new InvalidReservationStatusException(
        'Solo se puede confirmar la recepción de reservas en estado CONFIRMED',
      );
    }

    this.logger.log('Inquilino confirma recepción', {
      reservationId: id,
      renterId,
    });

    const updated = await this.prisma.reservation.updateMany({
      where: {
        id,
        status: 'CONFIRMED',
        actualHandoffAt: { not: null },
        renterReceivedAt: null,
      },
      data: {
        renterReceivedAt: new Date(),
        status: 'ACTIVE',
      },
    });

    if (updated.count === 0) {
      const current = await this.getReservationOrThrow(id);
      if (current.renterReceivedAt) {
        return current;
      }
      throw new InvalidReservationStatusException(
        'Solo se puede confirmar la recepción de reservas en estado CONFIRMED',
      );
    }

    return this.getReservationOrThrow(id);
  }

  /**
   * El inquilino marca la devolución. Registra `renterReturnedAt` y la reserva
   * permanece en ACTIVE hasta que el dueño confirme la recepción final.
   * Idempotente: si ya la marcó, devuelve la reserva actual.
   */
  async returnProduct(id: string, renterId: string) {
    const reservation = await this.getReservationOrThrow(id);

    if (reservation.userId !== renterId) {
      throw new ForbiddenReservationException(
        'No tenés permiso para marcar la devolución de esta reserva',
      );
    }

    if (reservation.renterReturnedAt) {
      return reservation;
    }

    if (reservation.status !== 'ACTIVE') {
      throw new InvalidReservationStatusException(
        'Solo se puede marcar la devolución de reservas en estado ACTIVE',
      );
    }

    this.logger.log('Inquilino marca devolución', {
      reservationId: id,
      renterId,
    });

    const updated = await this.prisma.reservation.updateMany({
      where: { id, status: 'ACTIVE', renterReturnedAt: null },
      data: {
        renterReturnedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      const current = await this.getReservationOrThrow(id);
      if (current.renterReturnedAt) {
        return current;
      }
      throw new InvalidReservationStatusException(
        'Solo se puede marcar la devolución de reservas en estado ACTIVE',
      );
    }

    return this.getReservationOrThrow(id);
  }

  /**
   * El dueño confirma la recepción final. Exige que el inquilino haya marcado
   * la devolución y recién entonces cambia la reserva a COMPLETED.
   * Idempotente: si ya confirmó, devuelve la reserva actual.
   */
  async confirmReturnReceipt(id: string, ownerId: string) {
    const reservation = await this.getReservationOrThrow(id);

    if (reservation.product.ownerId !== ownerId) {
      throw new ForbiddenReservationException(
        'No tenés permiso para confirmar la devolución de esta reserva',
      );
    }

    if (reservation.actualReturnAt) {
      return reservation;
    }

    if (!reservation.renterReturnedAt) {
      throw new InvalidReservationStatusException(
        'El inquilino debe marcar la devolución antes de confirmar la recepción',
      );
    }

    if (reservation.status !== 'ACTIVE') {
      throw new InvalidReservationStatusException(
        'Solo se puede confirmar la devolución de reservas en estado ACTIVE',
      );
    }

    this.logger.log('Dueño confirma recepción final', {
      reservationId: id,
      ownerId,
    });

    const updated = await this.prisma.reservation.updateMany({
      where: {
        id,
        status: 'ACTIVE',
        renterReturnedAt: { not: null },
        actualReturnAt: null,
      },
      data: {
        actualReturnAt: new Date(),
        status: 'COMPLETED',
      },
    });

    if (updated.count === 0) {
      const current = await this.getReservationOrThrow(id);
      if (current.actualReturnAt) {
        return current;
      }
      throw new InvalidReservationStatusException(
        'Solo se puede confirmar la devolución de reservas en estado ACTIVE',
      );
    }

    return this.getReservationOrThrow(id);
  }

  private async getReservationOrThrow(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { include: { photos: true } },
        user: { select: SAFE_USER_SELECT },
      },
    });

    if (!reservation) {
      throw new ReservationNotFoundException(id);
    }

    return reservation;
  }
}
