import { Injectable, NotFoundException } from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(userId: string): Promise<Product[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId, product: { isDeleted: false } },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: { photos: true } } },
    });
    return favorites.map((favorite) => favorite.product);
  }

  async listIds(userId: string): Promise<string[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId, product: { isDeleted: false } },
      select: { productId: true },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((favorite) => favorite.productId);
  }

  async add(
    userId: string,
    productId: string,
  ): Promise<{ isFavorite: boolean }> {
    await this.assertProduct(productId);
    await this.prisma.favorite.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return { isFavorite: true };
  }

  async remove(
    userId: string,
    productId: string,
  ): Promise<{ isFavorite: boolean }> {
    await this.assertProduct(productId);
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
    return { isFavorite: false };
  }

  private async assertProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
  }
}
