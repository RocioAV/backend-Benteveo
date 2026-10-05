import { ChatService } from './chat.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ReservationsService } from '../reservations/reservations.service';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { Role } from '../../common/types/user.types';
import {
  ForbiddenReservationException,
  InvalidReservationStatusException,
} from '../../common/exceptions/reservation-exceptions';

describe('ChatService', () => {
  const findMany = jest.fn();
  const create = jest.fn();
  const findOne = jest.fn();
  const prisma = {
    message: { findMany, create },
  } as unknown as PrismaService;
  const reservations = { findOne } as unknown as ReservationsService;
  const service = new ChatService(prisma, reservations);
  const user: AuthenticatedUser = {
    sub: 'renter-1',
    email: 'renter@example.com',
    role: Role.USER,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findOne.mockResolvedValue({ id: 'reservation-1', status: 'ACTIVE' });
    findMany.mockResolvedValue([]);
    create.mockResolvedValue({
      id: 'message-1',
      reservationId: 'reservation-1',
      senderId: 'renter-1',
      content: 'hello',
      createdAt: new Date('2026-10-04T12:00:00.000Z'),
      readAt: null,
    });
  });

  it('authorizes history through ReservationsService and orders it ascending', async () => {
    await service.getHistory('reservation-1', user);

    expect(findOne).toHaveBeenCalledWith('reservation-1', user);
    expect(findMany).toHaveBeenCalledWith({
      where: { reservationId: 'reservation-1' },
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
  });

  it('does not query messages for an unrelated user', async () => {
    findOne.mockRejectedValue(new ForbiddenReservationException('forbidden'));

    await expect(
      service.getHistory('reservation-1', user),
    ).rejects.toBeInstanceOf(ForbiddenReservationException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('trims content and derives sender from the authenticated session', async () => {
    await service.createMessage('reservation-1', user, '  hello  ');

    expect(create).toHaveBeenCalledWith({
      data: {
        reservationId: 'reservation-1',
        senderId: 'renter-1',
        content: 'hello',
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
  });

  it('rejects blank, oversized, and closed-reservation messages', async () => {
    await expect(
      service.createMessage('reservation-1', user, '   '),
    ).rejects.toThrow('El mensaje no puede estar vacío');
    await expect(
      service.createMessage('reservation-1', user, 'x'.repeat(2001)),
    ).rejects.toThrow('no puede superar');

    findOne.mockResolvedValue({ id: 'reservation-1', status: 'COMPLETED' });
    await expect(
      service.createMessage('reservation-1', user, 'hello'),
    ).rejects.toBeInstanceOf(InvalidReservationStatusException);
    expect(create).not.toHaveBeenCalled();
  });
});
