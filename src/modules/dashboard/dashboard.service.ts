import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  findMyPublications(userId: string) {
    return this.prisma.product.findMany({
      where: {
        ownerId: userId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findMyRentals(userId: string) {
    return this.prisma.reservation.findMany({
      where: { userId },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findMyLoans(userId: string) {
    // Pendiente de confirmar con el equipo si, en el futuro, "mis prestamos"
    // debe limitarse a reservas ACTIVE y COMPLETED. Por ahora conserva el
    // comportamiento existente de findAsOwner y devuelve todos los estados.
    return this.prisma.reservation.findMany({
      where: {
        product: {
          ownerId: userId,
        },
      },
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
  }
}
