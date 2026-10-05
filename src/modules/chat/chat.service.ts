import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  CLOSED_RESERVATION_STATUSES,
  MAX_MESSAGE_LENGTH,
} from './chat.constants';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { InvalidReservationStatusException } from '../../common/exceptions/reservation-exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RESERVATIONS_SERVICE,
  type ReservationAccessPolicy,
} from '../reservations/reservations.tokens';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RESERVATIONS_SERVICE)
    private readonly reservationsService: ReservationAccessPolicy,
  ) {}

  async getHistory(reservationId: string, user: AuthenticatedUser) {
    await this.assertParticipant(reservationId, user);

    return this.prisma.message.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reservationId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
      },
    });
  }

  async createMessage(
    reservationId: string,
    user: AuthenticatedUser,
    content: string,
  ) {
    const reservation = await this.assertParticipant(reservationId, user);

    if (
      reservation.status === CLOSED_RESERVATION_STATUSES.CANCELLED ||
      reservation.status === CLOSED_RESERVATION_STATUSES.COMPLETED
    ) {
      throw new InvalidReservationStatusException(
        'No se pueden enviar mensajes en una reserva cerrada',
      );
    }

    if (typeof content !== 'string') {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'El contenido del mensaje debe ser texto',
        HttpStatus.BAD_REQUEST,
      );
    }

    const normalizedContent = content.trim();
    if (normalizedContent.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'El mensaje no puede estar vacío',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.message.create({
      data: {
        reservationId,
        senderId: user.sub,
        content: normalizedContent,
      },
      select: {
        id: true,
        reservationId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
      },
    });
  }

  async assertParticipant(reservationId: string, user: AuthenticatedUser) {
    return this.reservationsService.findOne(reservationId, user);
  }
}
