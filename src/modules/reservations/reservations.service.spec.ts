import { ForbiddenException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  ForbiddenReservationException,
  ProductNotFoundException,
} from '../../common/exceptions/reservation-exceptions';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/types/user.types';

const SAFE_USER_FIELDS = ['id', 'name', 'isIdentityVerified'];
const FORBIDDEN_USER_FIELDS = ['email', 'dni', 'role', 'password', 'phone'];

/** Afirma que un include de prisma usa `user: { select: ... }` seguro (sin email, DNI, role ni phone). */
function expectSafeUserInclude(include: any) {
  expect(include.user).not.toEqual(true);
  expect(include.user.select).toBeDefined();

  for (const field of SAFE_USER_FIELDS) {
    expect(include.user.select[field]).toBe(true);
  }
  for (const field of FORBIDDEN_USER_FIELDS) {
    expect(include.user.select[field]).toBeUndefined();
  }

  // El perfil se reduce a avatar: no debe fugar phone.
  expect(include.user.select.profile).toEqual({ select: { avatar: true } });
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
  const mockTransaction = jest.fn<Promise<any>, [any, any?]>();

  const mockPrisma = {
    product: { findFirst: mockProductFindFirst },
    reservation: {
      create: mockReservationCreate,
      findMany: mockReservationFindMany,
      findUnique: mockReservationFindUnique,
      findFirst: mockReservationFindFirst,
      update: mockReservationUpdate,
    },
    $transaction: mockTransaction,
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
    // Mock $transaction: ejecuta el callback con un tx que delega a los mocks
    mockTransaction.mockImplementation(async (callback: any) => {
      const tx = {
        reservation: {
          findFirst: mockReservationFindFirst,
          create: mockReservationCreate,
        },
      };
      return callback(tx);
    });
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

    it('usa transacción serializable', async () => {
      await service.create(dto, 'renter-1');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTransaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: 'Serializable' },
      );
    });

    it('lanza conflicto si las fechas se superponen', async () => {
      mockReservationFindFirst.mockResolvedValue({ id: 'conflict-1' });

      const promise = service.create(dto, 'renter-1');

      await expect(promise).rejects.toThrow('Las fechas solicitadas se superponen');
    });

    it('rechaza dateInit >= dateEnd sin ejecutar transacción', async () => {
      const badDto: CreateReservationDto = {
        productId: 'prod-1',
        dateInit: new Date(Date.now() + 172800000).toISOString(),
        dateEnd: new Date(Date.now() + 86400000).toISOString(),
      };

      const promise = service.create(badDto, 'renter-1');

      await expect(promise).rejects.toThrow('La fecha de inicio debe ser anterior');
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rechaza dateInit en el pasado sin ejecutar transacción', async () => {
      const pastDto: CreateReservationDto = {
        productId: 'prod-1',
        dateInit: new Date(Date.now() - 86400000).toISOString(),
        dateEnd: new Date(Date.now() + 86400000).toISOString(),
      };

      const promise = service.create(pastDto, 'renter-1');

      await expect(promise).rejects.toThrow('La fecha de inicio no puede ser en el pasado');
      expect(mockTransaction).not.toHaveBeenCalled();
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
      role: Role.USER,
    };
    const owner: AuthenticatedUser = {
      sub: 'owner-1',
      email: 'o@example.com',
      role: Role.USER,
    };
    const stranger: AuthenticatedUser = {
      sub: 'stranger-1',
      email: 's@example.com',
      role: Role.USER,
    };
    const admin: AuthenticatedUser = {
      sub: 'admin-1',
      email: 'a@example.com',
      role: Role.ADMIN,
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

});
