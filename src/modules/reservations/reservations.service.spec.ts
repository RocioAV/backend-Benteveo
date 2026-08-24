import { ForbiddenException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  ForbiddenReservationException,
  ProductNotFoundException,
} from '../../common/exceptions/reservation-exceptions';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const SAFE_USER_FIELDS = [
  'id',
  'name',
  'email',
  'dni',
  'role',
  'isIdentityVerified',
  'profile',
];

/** Afirma que un include de prisma usa `user: { select: ... }` seguro (sin password). */
function expectSafeUserInclude(include: any) {
  expect(include.user).not.toEqual(true);
  expect(include.user.select).toBeDefined();
  expect(include.user.select.password).toBeUndefined();
  for (const field of SAFE_USER_FIELDS) {
    expect(include.user.select[field]).toBe(true);
  }
}

const product = {
  id: 'prod-1',
  ownerId: 'owner-1',
  isAvailable: true,
  isDeleted: false,
};

const reservation = {
  id: 'res-1',
  userId: 'renter-1',
  productId: 'prod-1',
  status: 'PENDING',
  product: { id: 'prod-1', ownerId: 'owner-1' },
  user: { id: 'renter-1', name: 'Renter' },
};

describe('ReservationsService', () => {
  const mockProductFindFirst = jest.fn<Promise<any>, [any]>();
  const mockReservationCreate = jest.fn<Promise<any>, [any]>();
  const mockReservationFindMany = jest.fn<Promise<any>, [any]>();
  const mockReservationFindUnique = jest.fn<Promise<any>, [any]>();
  const mockReservationFindFirst = jest.fn<Promise<any>, [any]>();
  const mockReservationUpdate = jest.fn<Promise<any>, [any]>();

  const mockPrisma = {
    product: { findFirst: mockProductFindFirst },
    reservation: {
      create: mockReservationCreate,
      findMany: mockReservationFindMany,
      findUnique: mockReservationFindUnique,
      findFirst: mockReservationFindFirst,
      update: mockReservationUpdate,
    },
  } as unknown as PrismaService;

  const service = new ReservationsService(mockPrisma);

  const dto: CreateReservationDto = {
    productId: 'prod-1',
    dateInit: new Date(Date.now() + 86400000).toISOString(),
    dateEnd: new Date(Date.now() + 172800000).toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockProductFindFirst.mockResolvedValue(product);
    mockReservationFindFirst.mockResolvedValue(null); // sin conflicto de fechas
    mockReservationCreate.mockImplementation((args) =>
      Promise.resolve({ id: 'res-1', ...args.data }),
    );
  });

  describe('create (Fix 1 + Fix 5)', () => {
    it('no expone password del usuario: usa user.select en el include', async () => {
      await service.create(dto, 'renter-1');

      const { include } = mockReservationCreate.mock.calls[0][0];
      expectSafeUserInclude(include);
    });

    it('rechaza reservar tu propio producto con 403 Forbidden', async () => {
      mockProductFindFirst.mockResolvedValue({
        ...product,
        ownerId: 'renter-1',
      });

      const promise = service.create(dto, 'renter-1');

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(
        'No puedes reservar tu propio producto',
      );
      expect(mockReservationCreate).not.toHaveBeenCalled();
    });
  });

  describe('findAll (Fix 1)', () => {
    it('usa user.select seguro y no `user: true`', async () => {
      mockReservationFindMany.mockResolvedValue([]);

      await service.findAll({});

      const { include } = mockReservationFindMany.mock.calls[0][0];
      expectSafeUserInclude(include);
    });
  });

  describe('findAsOwner (Fix 1)', () => {
    it('usa user.select seguro', async () => {
      mockReservationFindMany.mockResolvedValue([]);

      await service.findAsOwner('owner-1');

      const { include } = mockReservationFindMany.mock.calls[0][0];
      expectSafeUserInclude(include);
    });
  });

  describe('findOne (Fix 4)', () => {
    const renter: AuthenticatedUser = {
      sub: 'renter-1',
      email: 'r@example.com',
      role: 'USER',
    };
    const owner: AuthenticatedUser = {
      sub: 'owner-1',
      email: 'o@example.com',
      role: 'USER',
    };
    const stranger: AuthenticatedUser = {
      sub: 'stranger-1',
      email: 's@example.com',
      role: 'USER',
    };
    const admin: AuthenticatedUser = {
      sub: 'admin-1',
      email: 'a@example.com',
      role: 'ADMIN',
    };

    it('permite leer al renter (reservation.userId === user.sub)', async () => {
      mockReservationFindUnique.mockResolvedValue(reservation);

      await expect(service.findOne('res-1', renter)).resolves.toEqual(
        reservation,
      );
    });

    it('permite leer al dueño del producto', async () => {
      mockReservationFindUnique.mockResolvedValue(reservation);

      await expect(service.findOne('res-1', owner)).resolves.toEqual(
        reservation,
      );
    });

    it('permite leer a un ADMIN aunque no sea parte', async () => {
      mockReservationFindUnique.mockResolvedValue(reservation);

      await expect(service.findOne('res-1', admin)).resolves.toEqual(
        reservation,
      );
    });

    it('rechaza con 403 a un usuario que no es renter, dueño ni admin', async () => {
      mockReservationFindUnique.mockResolvedValue(reservation);

      const promise = service.findOne('res-1', stranger);

      await expect(promise).rejects.toBeInstanceOf(ForbiddenReservationException);
      await expect(promise).rejects.toMatchObject({ status: 403 });
    });

    it('no expone password: usa user.select seguro', async () => {
      mockReservationFindUnique.mockResolvedValue(reservation);

      await service.findOne('res-1', renter);

      const { include } = mockReservationFindUnique.mock.calls[0][0];
      expectSafeUserInclude(include);
    });

    it('lanza 404 si la reserva no existe', async () => {
      mockReservationFindUnique.mockResolvedValue(null);

      await expect(service.findOne('nope', admin)).rejects.toBeInstanceOf(
        Error,
      );
      await expect(service.findOne('nope', admin)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('confirm (Fix 1)', () => {
    it('usa user.select seguro en el update y valida ownership', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...reservation,
        status: 'PENDING',
      });
      mockReservationUpdate.mockImplementation((args) =>
        Promise.resolve({ id: 'res-1', status: 'CONFIRMED' }),
      );

      await service.confirm('res-1', 'owner-1');

      const { include } = mockReservationUpdate.mock.calls[0][0];
      expectSafeUserInclude(include);
    });

    it('rechaza confirmar si no es el dueño', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...reservation,
        status: 'PENDING',
      });

      await expect(service.confirm('res-1', 'stranger-1')).rejects.toMatchObject(
        { status: 403 },
      );
      expect(mockReservationUpdate).not.toHaveBeenCalled();
    });
  });
});
