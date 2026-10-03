import { ForbiddenException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  ForbiddenReservationException,
  InvalidReservationStatusException,
} from '../../common/exceptions/reservation-exceptions';
import { PaymentReversalException } from '../../common/exceptions/payment-exceptions';
import type { MercadoPagoService } from '../payments/mercadopago.service';
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

/** Afirma que el producto se incluye con sus fotos (el mapper usa `photos[0]?.url`). */
function expectProductPhotosInclude(include: any) {
  expect(include.product).not.toEqual(true);
  expect(include.product).toEqual({ include: { photos: true } });
}

const product = {
  id: 'prod-1',
  ownerId: 'owner-1',
  isAvailable: true,
  isDeleted: false,
  priceDay: { toNumber: () => 100 },
  deposit: { toNumber: () => 50 },
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
  const mockReservationUpdateMany = jest.fn<Promise<any>, [any]>();
  const mockTransaction = jest.fn<Promise<any>, [any, any?]>();
  const mockPaymentFindUnique = jest.fn<Promise<any>, [any]>();
  const mockPaymentCreate = jest.fn<Promise<any>, [any]>();
  const mockReversePayment = jest.fn<Promise<any>, [string]>();

  const mockPrisma = {
    product: { findFirst: mockProductFindFirst },
    reservation: {
      create: mockReservationCreate,
      findMany: mockReservationFindMany,
      findUnique: mockReservationFindUnique,
      findFirst: mockReservationFindFirst,
      update: mockReservationUpdate,
      updateMany: mockReservationUpdateMany,
    },
    payment: { findUnique: mockPaymentFindUnique, create: mockPaymentCreate },
    $transaction: mockTransaction,
  } as unknown as PrismaService;

  const mockMercadoPago = {
    reversePayment: mockReversePayment,
  } as unknown as MercadoPagoService;

  const service = new ReservationsService(mockPrisma, mockMercadoPago);

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
        payment: {
          create: mockPaymentCreate,
        },
      };
      return callback(tx);
    });
    mockPaymentCreate.mockImplementation((args) =>
      Promise.resolve({ id: 'pay-1', ...args.data }),
    );
    mockReservationUpdateMany.mockResolvedValue({ count: 1 });
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
      expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
    });

    it('lanza conflicto si las fechas se superponen', async () => {
      mockReservationFindFirst.mockResolvedValue({ id: 'conflict-1' });

      const promise = service.create(dto, 'renter-1');

      await expect(promise).rejects.toThrow(
        'Las fechas solicitadas se superponen',
      );
    });

    it('rechaza dateInit >= dateEnd sin ejecutar transacción', async () => {
      const badDto: CreateReservationDto = {
        productId: 'prod-1',
        dateInit: new Date(Date.now() + 172800000).toISOString(),
        dateEnd: new Date(Date.now() + 86400000).toISOString(),
      };

      const promise = service.create(badDto, 'renter-1');

      await expect(promise).rejects.toThrow(
        'La fecha de fin debe ser posterior a la fecha de inicio',
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rechaza dateInit en el pasado sin ejecutar transacción', async () => {
      const pastDto: CreateReservationDto = {
        productId: 'prod-1',
        dateInit: new Date(Date.now() - 86400000).toISOString(),
        dateEnd: new Date(Date.now() + 86400000).toISOString(),
      };

      const promise = service.create(pastDto, 'renter-1');

      await expect(promise).rejects.toThrow(
        'La fecha de inicio no puede ser anterior a la fecha actual',
      );
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

  describe('product photos (Bloque 1: imageUrl desde photos[0])', () => {
    it('create incluye las fotos del producto', async () => {
      await service.create(dto, 'renter-1');

      const { include } = mockReservationCreate.mock.calls[0][0];
      expectProductPhotosInclude(include);
    });

    it('findAll incluye las fotos del producto', async () => {
      mockReservationFindMany.mockResolvedValue([]);

      await service.findAll({});

      const { include } = mockReservationFindMany.mock.calls[0][0];
      expectProductPhotosInclude(include);
    });

    it('findMyReservations (inquilino) incluye las fotos del producto', async () => {
      mockReservationFindMany.mockResolvedValue([]);

      await service.findMyReservations('renter-1');

      const { include } = mockReservationFindMany.mock.calls[0][0];
      expectProductPhotosInclude(include);
    });

    it('findAsOwner (dueño) incluye las fotos del producto', async () => {
      mockReservationFindMany.mockResolvedValue([]);

      await service.findAsOwner('owner-1');

      const { include } = mockReservationFindMany.mock.calls[0][0];
      expectProductPhotosInclude(include);
    });

    it('findOne (detalle) incluye las fotos del producto', async () => {
      mockReservationFindUnique.mockResolvedValue(reservation);
      const renter: AuthenticatedUser = {
        sub: 'renter-1',
        email: 'r@example.com',
        role: Role.USER,
      };

      await service.findOne('res-1', renter);

      const { include } = mockReservationFindUnique.mock.calls[0][0];
      expectProductPhotosInclude(include);
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

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
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

  describe('cancel (reverso Mercado Pago)', () => {
    beforeEach(() => {
      mockReservationFindUnique.mockResolvedValue(reservation);
      mockPaymentFindUnique.mockResolvedValue({
        id: 'pay-1',
        reservationId: 'res-1',
        status: 'APPROVED',
        mercadoPagoPaymentId: 'mp-1',
      });
      mockReversePayment.mockResolvedValue('REFUNDED');
      mockReservationUpdate.mockImplementation(
        (args: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...reservation, ...args.data }),
      );
    });

    it('revierte el pago en Mercado Pago antes de cancelar', async () => {
      await service.cancel('res-1', 'renter-1', Role.USER);

      expect(mockReversePayment).toHaveBeenCalledWith('pay-1');
      expect(mockReversePayment.mock.invocationCallOrder[0]).toBeLessThan(
        mockReservationUpdate.mock.invocationCallOrder[0],
      );
    });

    it('setea status CANCELLED y cancellationConfirmedAt', async () => {
      await service.cancel('res-1', 'renter-1', Role.USER);

      const updateArgs = mockReservationUpdate.mock.calls[0][0] as {
        data: { status: string; cancellationConfirmedAt: unknown };
        include: { payment: boolean };
      };
      expect(updateArgs.data.status).toBe('CANCELLED');
      expect(updateArgs.data.cancellationConfirmedAt).toBeInstanceOf(Date);
      expect(updateArgs.include.payment).toBe(true);
    });

    it('cancela igual si el reverso en MP falla (reembolso simulado)', async () => {
      mockReversePayment.mockRejectedValue(
        new PaymentReversalException('pay-1'),
      );

      const cancelled = await service.cancel('res-1', 'renter-1', Role.USER);

      expect(mockReversePayment).toHaveBeenCalledWith('pay-1');
      expect(mockReversePayment.mock.invocationCallOrder[0]).toBeLessThan(
        mockReservationUpdate.mock.invocationCallOrder[0],
      );
      expect(mockReservationUpdate).toHaveBeenCalledTimes(1);

      const updateArgs = mockReservationUpdate.mock.calls[0][0] as {
        data: { status: string };
      };
      expect(updateArgs.data.status).toBe('CANCELLED');
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('cancela aunque la reserva no tenga pago asociado', async () => {
      mockPaymentFindUnique.mockResolvedValue(null);

      await service.cancel('res-1', 'renter-1', Role.USER);

      expect(mockReversePayment).not.toHaveBeenCalled();
      expect(mockReservationUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('handoff bilateral (dueño marca entrega, queda CONFIRMED)', () => {
    const confirmed = {
      ...reservation,
      status: 'CONFIRMED',
      actualHandoffAt: null,
      renterReceivedAt: null,
      renterReturnedAt: null,
      actualReturnAt: null,
    };

    it('registra actualHandoffAt y permanece CONFIRMED', async () => {
      mockReservationFindUnique
        .mockResolvedValueOnce(confirmed)
        .mockResolvedValueOnce({
          ...confirmed,
          actualHandoffAt: new Date(),
        });

      const result = await service.handoff('res-1', 'owner-1', 'notas');

      expect(mockReservationUpdateMany).toHaveBeenCalledTimes(1);
      const updateArgs = mockReservationUpdateMany.mock.calls[0][0];
      expect(updateArgs.where).toMatchObject({
        id: 'res-1',
        status: 'CONFIRMED',
        actualHandoffAt: null,
      });
      expect(updateArgs.data.actualHandoffAt).toBeInstanceOf(Date);
      expect(updateArgs.data.handoffNotes).toBe('notas');
      expect(updateArgs.data.status).toBeUndefined();
      expect(result.actualHandoffAt).toBeInstanceOf(Date);
      // La lectura final usa include seguro.
      const { include } =
        mockReservationFindUnique.mock.calls[
          mockReservationFindUnique.mock.calls.length - 1
        ][0];
      expectSafeUserInclude(include);
    });

    it('rechaza con 403 si quien marca no es el dueño', async () => {
      mockReservationFindUnique.mockResolvedValue(confirmed);

      const promise = service.handoff('res-1', 'renter-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza con 403 a un tercero aunque conozca el ID', async () => {
      mockReservationFindUnique.mockResolvedValue(confirmed);

      const promise = service.handoff('res-1', 'stranger-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza orden inválido: no se puede entregar una reserva PENDING', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...confirmed,
        status: 'PENDING',
      });

      const promise = service.handoff('res-1', 'owner-1');

      await expect(promise).rejects.toBeInstanceOf(
        InvalidReservationStatusException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('es idempotente: repetir el handoff devuelve la reserva sin actualizar', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...confirmed,
        actualHandoffAt: new Date('2026-09-30T10:00:00.000Z'),
      });

      const result = await service.handoff('res-1', 'owner-1');

      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
      expect(result.actualHandoffAt).toEqual(
        new Date('2026-09-30T10:00:00.000Z'),
      );
    });

    it('resuelve una transición concurrente devolviendo la reserva ya marcada', async () => {
      mockReservationFindUnique
        .mockResolvedValueOnce(confirmed)
        .mockResolvedValueOnce({
          ...confirmed,
          actualHandoffAt: new Date('2026-09-30T10:00:00.000Z'),
        });
      mockReservationUpdateMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.handoff('res-1', 'owner-1');

      expect(result.actualHandoffAt).toEqual(
        new Date('2026-09-30T10:00:00.000Z'),
      );
    });
  });

  describe('confirmHandoffReceipt (inquilino confirma, pasa a ACTIVE)', () => {
    const delivered = {
      ...reservation,
      status: 'CONFIRMED',
      actualHandoffAt: new Date('2026-09-30T10:00:00.000Z'),
      renterReceivedAt: null,
      renterReturnedAt: null,
      actualReturnAt: null,
    };

    it('registra renterReceivedAt y cambia a ACTIVE', async () => {
      mockReservationFindUnique
        .mockResolvedValueOnce(delivered)
        .mockResolvedValueOnce({
          ...delivered,
          status: 'ACTIVE',
          renterReceivedAt: new Date(),
        });

      const result = await service.confirmHandoffReceipt('res-1', 'renter-1');

      expect(mockReservationUpdateMany).toHaveBeenCalledTimes(1);
      const updateArgs = mockReservationUpdateMany.mock.calls[0][0];
      expect(updateArgs.where).toMatchObject({
        id: 'res-1',
        status: 'CONFIRMED',
        renterReceivedAt: null,
      });
      expect(updateArgs.data.renterReceivedAt).toBeInstanceOf(Date);
      expect(updateArgs.data.status).toBe('ACTIVE');
      expect(result.status).toBe('ACTIVE');
    });

    it('rechaza con 403 si el dueño intenta confirmar la recepción', async () => {
      mockReservationFindUnique.mockResolvedValue(delivered);

      const promise = service.confirmHandoffReceipt('res-1', 'owner-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza con 403 a un tercero aunque conozca el ID', async () => {
      mockReservationFindUnique.mockResolvedValue(delivered);

      const promise = service.confirmHandoffReceipt('res-1', 'stranger-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza orden inválido: no se puede confirmar sin entrega del dueño', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...reservation,
        status: 'CONFIRMED',
        actualHandoffAt: null,
        renterReceivedAt: null,
      });

      const promise = service.confirmHandoffReceipt('res-1', 'renter-1');

      await expect(promise).rejects.toBeInstanceOf(
        InvalidReservationStatusException,
      );
      await expect(promise).rejects.toThrow(
        'El dueño debe marcar la entrega antes de confirmar la recepción',
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('es idempotente: repetir la confirmación devuelve la reserva sin actualizar', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...delivered,
        status: 'ACTIVE',
        renterReceivedAt: new Date('2026-09-30T11:00:00.000Z'),
      });

      const result = await service.confirmHandoffReceipt('res-1', 'renter-1');

      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('returnProduct (inquilino marca devolución, queda ACTIVE)', () => {
    const active = {
      ...reservation,
      status: 'ACTIVE',
      actualHandoffAt: new Date('2026-09-30T10:00:00.000Z'),
      renterReceivedAt: new Date('2026-09-30T11:00:00.000Z'),
      renterReturnedAt: null,
      actualReturnAt: null,
    };

    it('registra renterReturnedAt y permanece ACTIVE', async () => {
      mockReservationFindUnique
        .mockResolvedValueOnce(active)
        .mockResolvedValueOnce({
          ...active,
          renterReturnedAt: new Date(),
        });

      const result = await service.returnProduct('res-1', 'renter-1');

      expect(mockReservationUpdateMany).toHaveBeenCalledTimes(1);
      const updateArgs = mockReservationUpdateMany.mock.calls[0][0];
      expect(updateArgs.where).toMatchObject({
        id: 'res-1',
        status: 'ACTIVE',
        renterReturnedAt: null,
      });
      expect(updateArgs.data.renterReturnedAt).toBeInstanceOf(Date);
      expect(updateArgs.data.status).toBeUndefined();
      expect(result.status).toBe('ACTIVE');
      expect(result.renterReturnedAt).toBeInstanceOf(Date);
    });

    it('rechaza con 403 si el dueño intenta marcar la devolución', async () => {
      mockReservationFindUnique.mockResolvedValue(active);

      const promise = service.returnProduct('res-1', 'owner-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza con 403 a un tercero aunque conozca el ID', async () => {
      mockReservationFindUnique.mockResolvedValue(active);

      const promise = service.returnProduct('res-1', 'stranger-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza orden inválido: no se puede marcar devolución en CONFIRMED', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...active,
        status: 'CONFIRMED',
      });

      const promise = service.returnProduct('res-1', 'renter-1');

      await expect(promise).rejects.toBeInstanceOf(
        InvalidReservationStatusException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('es idempotente: repetir la devolución devuelve la reserva sin actualizar', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...active,
        renterReturnedAt: new Date('2026-09-30T12:00:00.000Z'),
      });

      const result = await service.returnProduct('res-1', 'renter-1');

      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('confirmReturnReceipt (dueño confirma, pasa a COMPLETED)', () => {
    const returned = {
      ...reservation,
      status: 'ACTIVE',
      actualHandoffAt: new Date('2026-09-30T10:00:00.000Z'),
      renterReceivedAt: new Date('2026-09-30T11:00:00.000Z'),
      renterReturnedAt: new Date('2026-09-30T12:00:00.000Z'),
      actualReturnAt: null,
    };

    it('registra actualReturnAt y cambia a COMPLETED', async () => {
      mockReservationFindUnique
        .mockResolvedValueOnce(returned)
        .mockResolvedValueOnce({
          ...returned,
          status: 'COMPLETED',
          actualReturnAt: new Date(),
        });

      const result = await service.confirmReturnReceipt('res-1', 'owner-1');

      expect(mockReservationUpdateMany).toHaveBeenCalledTimes(1);
      const updateArgs = mockReservationUpdateMany.mock.calls[0][0];
      expect(updateArgs.where).toMatchObject({
        id: 'res-1',
        status: 'ACTIVE',
        actualReturnAt: null,
      });
      expect(updateArgs.data.actualReturnAt).toBeInstanceOf(Date);
      expect(updateArgs.data.status).toBe('COMPLETED');
      expect(result.status).toBe('COMPLETED');
    });

    it('rechaza con 403 si el inquilino intenta confirmar la recepción final', async () => {
      mockReservationFindUnique.mockResolvedValue(returned);

      const promise = service.confirmReturnReceipt('res-1', 'renter-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza con 403 a un tercero aunque conozca el ID', async () => {
      mockReservationFindUnique.mockResolvedValue(returned);

      const promise = service.confirmReturnReceipt('res-1', 'stranger-1');

      await expect(promise).rejects.toBeInstanceOf(
        ForbiddenReservationException,
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('rechaza orden inválido: no se puede completar sin devolución del inquilino', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...returned,
        renterReturnedAt: null,
      });

      const promise = service.confirmReturnReceipt('res-1', 'owner-1');

      await expect(promise).rejects.toBeInstanceOf(
        InvalidReservationStatusException,
      );
      await expect(promise).rejects.toThrow(
        'El inquilino debe marcar la devolución antes de confirmar la recepción',
      );
      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
    });

    it('es idempotente: repetir la confirmación final devuelve la reserva sin actualizar', async () => {
      mockReservationFindUnique.mockResolvedValue({
        ...returned,
        status: 'COMPLETED',
        actualReturnAt: new Date('2026-09-30T13:00:00.000Z'),
      });

      const result = await service.confirmReturnReceipt('res-1', 'owner-1');

      expect(mockReservationUpdateMany).not.toHaveBeenCalled();
      expect(result.status).toBe('COMPLETED');
    });
  });
});
