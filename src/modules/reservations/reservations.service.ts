import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateReservationDto, userId: string) {
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
    const initDate = new Date(dateInit.getFullYear(), dateInit.getMonth(), dateInit.getDate());
    const endDate = new Date(dateEnd.getFullYear(), dateEnd.getMonth(), dateEnd.getDate());

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

        return tx.reservation.create({
          data: {
            dateInit,
            dateEnd,
            status: 'PENDING',
            productId: dto.productId,
            userId,
          },
          include: {
            product: true,
            user: { select: SAFE_USER_SELECT },
          },
        });
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
        product: true,
        user: { select: SAFE_USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyReservations(userId: string) {
    return this.prisma.reservation.findMany({
      where: { userId },
      include: {
        product: true,
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
        product: true,
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

  async confirm(id: string, ownerId: string) {
    const reservation = await this.getReservationOrThrow(id);

    if (reservation.product.ownerId !== ownerId) {
      throw new ForbiddenReservationException(
        'No tenés permiso para confirmar esta reserva',
      );
    }

    if (reservation.status !== 'PENDING') {
      throw new InvalidReservationStatusException(
        'Solo se pueden confirmar reservas en estado PENDING',
      );
    }

    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: {
        product: true,
        user: { select: SAFE_USER_SELECT },
      },
    });
  }

  async cancel(id: string, userId: string) {
    const reservation = await this.getReservationOrThrow(id);

    const isOwner = reservation.product.ownerId === userId;
    const isRenter = reservation.userId === userId;

    if (!isOwner && !isRenter) {
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

    return this.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        product: true,
        user: { select: SAFE_USER_SELECT },
      },
    });
  }

  async handoff(id: string, ownerId: string, notes?: string) {
    const reservation = await this.getReservationOrThrow(id);

    if (reservation.product.ownerId !== ownerId) {
      throw new ForbiddenReservationException(
        'No tenés permiso para entregar esta reserva',
      );
    }

    if (reservation.status !== 'CONFIRMED') {
      throw new InvalidReservationStatusException(
        'Solo se pueden entregar reservas en estado CONFIRMED',
      );
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        actualHandoffAt: new Date(),
        handoffNotes: notes,
      },
      include: {
        product: true,
        user: { select: SAFE_USER_SELECT },
      },
    });
  }

  async returnProduct(id: string, ownerId: string) {
    const reservation = await this.getReservationOrThrow(id);

    if (reservation.product.ownerId !== ownerId) {
      throw new ForbiddenReservationException(
        'No tenés permiso para recibir esta reserva',
      );
    }

    if (reservation.status !== 'ACTIVE') {
      throw new InvalidReservationStatusException(
        'Solo se pueden devolver reservas en estado ACTIVE',
      );
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualReturnAt: new Date(),
      },
      include: {
        product: true,
        user: { select: SAFE_USER_SELECT },
      },
    });
  }

  private async getReservationOrThrow(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        product: true,
        user: { select: SAFE_USER_SELECT },
      },
    });

    if (!reservation) {
      throw new ReservationNotFoundException(id);
    }

    return reservation;
  }
}
