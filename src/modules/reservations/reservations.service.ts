import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
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

    if (!product.isAvailable) {
      throw new ProductNotAvailableException(dto.productId);
    }

    const dateInit = new Date(dto.dateInit);
    const dateEnd = new Date(dto.dateEnd);

    if (dateInit >= dateEnd) {
      throw new InvalidReservationDatesException(
        'La fecha de inicio debe ser anterior a la fecha de fin',
      );
    }

    if (dateInit < new Date()) {
      throw new InvalidReservationDatesException(
        'La fecha de inicio no puede ser en el pasado',
      );
    }

    const hasConflict = await this.checkDateConflict(
      dto.productId,
      dateInit,
      dateEnd,
    );

    if (hasConflict) {
      throw new ReservationConflictException(
        'Las fechas solicitadas se superponen con otra reserva existente',
      );
    }

    return this.prisma.reservation.create({
      data: {
        dateInit,
        dateEnd,
        status: 'PENDING',
        productId: dto.productId,
        userId,
      },
      include: {
        product: true,
        user: true,
      },
    });
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
        user: true,
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
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        product: true,
        user: true,
      },
    });

    if (!reservation) {
      throw new ReservationNotFoundException(id);
    }

    return reservation;
  }

  async confirm(id: string, ownerId: string) {
    const reservation = await this.findOne(id);

    if (reservation.product.ownerId !== ownerId) {
      throw new ForbiddenReservationException('No tenés permiso para confirmar esta reserva');
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
        user: true,
      },
    });
  }

  async cancel(id: string, userId: string) {
    const reservation = await this.findOne(id);

    const isOwner = reservation.product.ownerId === userId;
    const isRenter = reservation.userId === userId;

    if (!isOwner && !isRenter) {
      throw new ForbiddenReservationException('No tenés permiso para cancelar esta reserva');
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
        user: true,
      },
    });
  }

  async handoff(id: string, ownerId: string, notes?: string) {
    const reservation = await this.findOne(id);

    if (reservation.product.ownerId !== ownerId) {
      throw new ForbiddenReservationException('No tenés permiso para entregar esta reserva');
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
        user: true,
      },
    });
  }

  async returnProduct(id: string, ownerId: string) {
    const reservation = await this.findOne(id);

    if (reservation.product.ownerId !== ownerId) {
      throw new ForbiddenReservationException('No tenés permiso para recibir esta reserva');
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
        user: true,
      },
    });
  }

  private async checkDateConflict(
    productId: string,
    dateInit: Date,
    dateEnd: Date,
  ): Promise<boolean> {
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        productId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        dateInit: { lt: dateEnd },
        dateEnd: { gt: dateInit },
      },
    });

    return !!conflict;
  }
}
