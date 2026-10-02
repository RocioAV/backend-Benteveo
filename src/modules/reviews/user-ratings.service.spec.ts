import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { UserRatingsService } from './user-ratings.service';
import { CreateUserRatingDto } from './dto/create-user-rating.dto';
import {
  ForbiddenReservationException,
  InvalidReservationStatusException,
  ReservationConflictException,
  ReservationNotFoundException,
} from '../../common/exceptions/reservation-exceptions';
import type { PrismaService } from '../../prisma/prisma.service';

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed on the fields: (`reservationId`, `raterId`)',
    {
      code: 'P2002',
      clientVersion: Prisma.prismaVersion.client,
      meta: { target: ['reservationId', 'raterId'] },
    },
  );
}

const completed = {
  id: 'res-1',
  status: 'COMPLETED',
  userId: 'renter-1',
  product: { ownerId: 'owner-1' },
};

describe('UserRatingsService', () => {
  const mockReservationFindUnique = jest.fn<Promise<any>, [any]>();
  const mockUserRatingFindUnique = jest.fn<Promise<any>, [any]>();
  const mockUserRatingCreate = jest.fn<Promise<any>, [any]>();

  const mockPrisma = {
    reservation: { findUnique: mockReservationFindUnique },
    userRating: {
      findUnique: mockUserRatingFindUnique,
      create: mockUserRatingCreate,
    },
  } as unknown as PrismaService;

  const service = new UserRatingsService(mockPrisma);

  beforeEach(() => {
    jest.clearAllMocks();
    mockReservationFindUnique.mockResolvedValue(completed);
    mockUserRatingFindUnique.mockResolvedValue(null);
    mockUserRatingCreate.mockImplementation((args) =>
      Promise.resolve({ createdAt: new Date(), ...args.data }),
    );
  });

  describe('rate', () => {
    it('el inquilino califica al dueño (ratedUserId derivado, no del cliente)', async () => {
      const result = await service.rate('res-1', 'renter-1', 5);

      expect(mockUserRatingCreate).toHaveBeenCalledTimes(1);
      const { data, select } = mockUserRatingCreate.mock.calls[0][0];
      expect(data).toEqual({
        reservationId: 'res-1',
        raterId: 'renter-1',
        ratedUserId: 'owner-1',
        score: 5,
      });
      expect(data).not.toHaveProperty('ratedUserId', 'renter-1');
      expect(result.ratedUserId).toBe('owner-1');
      // Solo campos públicos seguros.
      expect(Object.keys(select).sort()).toEqual(
        ['createdAt', 'id', 'ratedUserId', 'raterId', 'reservationId', 'score'].sort(),
      );
    });

    it('el dueño califica al inquilino', async () => {
      const result = await service.rate('res-1', 'owner-1', 4);

      const { data } = mockUserRatingCreate.mock.calls[0][0];
      expect(data).toEqual({
        reservationId: 'res-1',
        raterId: 'owner-1',
        ratedUserId: 'renter-1',
        score: 4,
      });
      expect(result.ratedUserId).toBe('renter-1');
    });

    it('rechaza con 403 a quien no es parte de la reserva', async () => {
      const promise = service.rate('res-1', 'stranger-1', 5);

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      await expect(promise).rejects.toMatchObject({ status: 403 });
      expect(mockUserRatingCreate).not.toHaveBeenCalled();
    });

    it('rechaza con 400 si la reserva no está COMPLETED', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...completed,
        status: 'ACTIVE',
      });

      const promise = service.rate('res-1', 'renter-1', 5);

      await expect(promise).rejects.toBeInstanceOf(
        InvalidReservationStatusException,
      );
      expect(mockUserRatingCreate).not.toHaveBeenCalled();
    });

    it('lanza 404 si la reserva no existe', async () => {
      mockReservationFindUnique.mockResolvedValue(null);

      const promise = service.rate('nope', 'renter-1', 5);

      await expect(promise).rejects.toBeInstanceOf(
        ReservationNotFoundException,
      );
      expect(mockUserRatingCreate).not.toHaveBeenCalled();
    });

    it.each([0, 6, 1.5, Number.NaN])(
      'rechaza puntaje inválido %s en el borde del servicio sin tocar prisma',
      async (score) => {
        const promise = service.rate('res-1', 'renter-1', score);

        await expect(promise).rejects.toBeInstanceOf(
          InvalidReservationStatusException,
        );
        await expect(promise).rejects.toThrow(
          'El puntaje debe ser un entero entre 1 y 5',
        );
        expect(mockReservationFindUnique).not.toHaveBeenCalled();
        expect(mockUserRatingCreate).not.toHaveBeenCalled();
      },
    );

    it('rechaza la autocalificación aunque la derivación la impida', async () => {
      mockReservationFindUnique.mockResolvedValue({
        id: 'res-1',
        status: 'COMPLETED',
        userId: 'owner-1',
        product: { ownerId: 'owner-1' },
      });

      const promise = service.rate('res-1', 'owner-1', 5);

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockUserRatingCreate).not.toHaveBeenCalled();
    });

    it('rechaza el duplicado por prechequeo con 409 sin insertar', async () => {
      mockUserRatingFindUnique.mockResolvedValue({ id: 'ur-1' });

      const promise = service.rate('res-1', 'renter-1', 5);

      await expect(promise).rejects.toBeInstanceOf(
        ReservationConflictException,
      );
      await expect(promise).rejects.toMatchObject({ status: 409 });
      expect(mockUserRatingCreate).not.toHaveBeenCalled();
    });

    it('traduce la carrera P2002 (unique) a conflicto 409', async () => {
      mockUserRatingCreate.mockRejectedValue(p2002());

      const promise = service.rate('res-1', 'renter-1', 5);

      await expect(promise).rejects.toBeInstanceOf(
        ReservationConflictException,
      );
      await expect(promise).rejects.toMatchObject({ status: 409 });
    });

    it('una calificación en otra reserva completada no se bloquea', async () => {
      mockReservationFindUnique.mockResolvedValue({
        id: 'res-2',
        status: 'COMPLETED',
        userId: 'renter-1',
        product: { ownerId: 'owner-1' },
      });

      const result = await service.rate('res-2', 'renter-1', 3);

      expect(mockUserRatingCreate).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        reservationId: 'res-2',
        raterId: 'renter-1',
        ratedUserId: 'owner-1',
        score: 3,
      });
    });
  });

  describe('mine', () => {
    it('devuelve rated:false y rating:null si aún no calificó', async () => {
      const result = await service.mine('res-1', 'renter-1');

      expect(result).toEqual({ rated: false, rating: null });
      expect(mockUserRatingFindUnique).toHaveBeenCalledWith({
        where: {
          reservationId_raterId: { reservationId: 'res-1', raterId: 'renter-1' },
        },
        select: expect.anything(),
      });
    });

    it('devuelve rated:true con los campos públicos si ya calificó', async () => {
      const stored = {
        id: 'ur-1',
        score: 5,
        reservationId: 'res-1',
        raterId: 'renter-1',
        ratedUserId: 'owner-1',
        createdAt: new Date(),
      };
      mockUserRatingFindUnique.mockResolvedValue(stored);

      const result = await service.mine('res-1', 'renter-1');

      expect(result).toEqual({ rated: true, rating: stored });
    });

    it('rechaza con 403 a un tercero', async () => {
      const promise = service.mine('res-1', 'stranger-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockUserRatingFindUnique).not.toHaveBeenCalled();
    });

    it('lanza 404 si la reserva no existe', async () => {
      mockReservationFindUnique.mockResolvedValue(null);

      await expect(service.mine('nope', 'renter-1')).rejects.toBeInstanceOf(
        ReservationNotFoundException,
      );
    });
  });

  describe('CreateUserRatingDto', () => {
    it.each([0, 6, 1.5])('rechaza score=%s por validación', async (score) => {
      const dto = Object.assign(new CreateUserRatingDto(), { score });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('acepta score entero entre 1 y 5', async () => {
      const dto = Object.assign(new CreateUserRatingDto(), { score: 4 });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });
  });
});
