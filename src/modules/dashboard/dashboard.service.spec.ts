import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  const productFindMany = jest.fn();
  const reservationFindMany = jest.fn();
  const prisma = {
    product: { findMany: productFindMany },
    reservation: { findMany: reservationFindMany },
  } as unknown as PrismaService;
  const service = new DashboardService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('busca las publicaciones activas del usuario', async () => {
    productFindMany.mockResolvedValue([]);

    await service.findMyPublications('user-id');

    expect(productFindMany).toHaveBeenCalledWith({
      where: { ownerId: 'user-id', isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('busca los alquileres solicitados por el usuario', async () => {
    reservationFindMany.mockResolvedValue([]);

    await service.findMyRentals('user-id');

    expect(reservationFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('busca los prestamos sin exponer datos privados del usuario', async () => {
    reservationFindMany.mockResolvedValue([]);

    await service.findMyLoans('user-id');

    expect(reservationFindMany).toHaveBeenCalledWith({
      where: { product: { ownerId: 'user-id' } },
      include: {
        product: true,
        user: {
          select: {
            id: true,
            name: true,
            isIdentityVerified: true,
            profile: {
              select: {
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
});
