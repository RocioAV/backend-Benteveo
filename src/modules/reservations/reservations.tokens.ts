import type { AuthenticatedUser } from '../../common/types/user.types';

export const RESERVATIONS_SERVICE = Symbol('RESERVATIONS_SERVICE');

export interface ReservationAccessPolicy {
  findOne(
    reservationId: string,
    user: AuthenticatedUser,
  ): Promise<{ status: string }>;
}
