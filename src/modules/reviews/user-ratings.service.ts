import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ForbiddenReservationException,
  InvalidReservationStatusException,
  ReservationConflictException,
  ReservationNotFoundException,
} from '../../common/exceptions/reservation-exceptions';

/** Campos públicos de una calificación entre usuarios (sin PII). */
export const SAFE_USER_RATING_SELECT =
  Prisma.validator<Prisma.UserRatingSelect>()({
    id: true,
    score: true,
    reservationId: true,
    raterId: true,
    ratedUserId: true,
    createdAt: true,
  });

export type SafeUserRating = Prisma.UserRatingGetPayload<{
  select: typeof SAFE_USER_RATING_SELECT;
}>;

export interface UserRatingMineResult {
  rated: boolean;
  rating: SafeUserRating | null;
}

/**
 * Calificaciones entre personas asociadas a una reserva completada.
 * No toca el dominio de calificaciones de productos (`Rating`).
 */
@Injectable()
export class UserRatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Califica a la contraparte de una reserva COMPLETED.
   * El dueño califica al inquilino y el inquilino al dueño;
   * `ratedUserId` siempre se deriva de la reserva, nunca del cliente.
   */
  async rate(
    reservationId: string,
    raterId: string,
    score: number,
  ): Promise<SafeUserRating> {
    this.assertValidScore(score);

    const reservation = await this.getReservationOrThrow(reservationId);

    const isRenter = reservation.userId === raterId;
    const isOwner = reservation.product.ownerId === raterId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenReservationException(
        'No tenés permiso para calificar esta reserva',
      );
    }

    if (reservation.status !== 'COMPLETED') {
      throw new InvalidReservationStatusException(
        'Solo se puede calificar una reserva en estado COMPLETED',
      );
    }

    const ratedUserId = isOwner ? reservation.userId : reservation.product.ownerId;

    if (ratedUserId === raterId) {
      throw new ForbiddenReservationException(
        'No podés calificarte a vos mismo',
      );
    }

    const existing = await this.prisma.userRating.findUnique({
      where: { reservationId_raterId: { reservationId, raterId } },
      select: { id: true },
    });

    if (existing) {
      throw new ReservationConflictException(
        'Ya calificaste a la otra persona en esta reserva',
      );
    }

    try {
      return await this.prisma.userRating.create({
        data: { reservationId, raterId, ratedUserId, score },
        select: SAFE_USER_RATING_SELECT,
      });
    } catch (error) {
      // Carrera entre la prechequeo y el insert: la restricción única manda.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ReservationConflictException(
          'Ya calificaste a la otra persona en esta reserva',
        );
      }
      throw error;
    }
  }

  /**
   * Indica si el participante actual ya calificó esta reserva.
   * Rechaza a terceros igual que `rate`.
   */
  async mine(
    reservationId: string,
    userId: string,
  ): Promise<UserRatingMineResult> {
    const reservation = await this.getReservationOrThrow(reservationId);

    const isRenter = reservation.userId === userId;
    const isOwner = reservation.product.ownerId === userId;

    if (!isRenter && !isOwner) {
      throw new ForbiddenReservationException(
        'No tenés permiso para ver la calificación de esta reserva',
      );
    }

    const rating = await this.prisma.userRating.findUnique({
      where: { reservationId_raterId: { reservationId, raterId: userId } },
      select: SAFE_USER_RATING_SELECT,
    });

    return rating ? { rated: true, rating } : { rated: false, rating: null };
  }

  private assertValidScore(score: number): void {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      throw new InvalidReservationStatusException(
        'El puntaje debe ser un entero entre 1 y 5',
      );
    }
  }

  private async getReservationOrThrow(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userId: true,
        product: { select: { ownerId: true } },
      },
    });

    if (!reservation) {
      throw new ReservationNotFoundException(id);
    }

    return reservation;
  }
}
