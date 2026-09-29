import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CommentRecord {
  id: string;
  text: string;
  authorId: string;
  author: string;
  avatar: string | null;
  rating: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RatingSummary {
  score: number;
  rating: number;
  reviewCount: number;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listComments(productId: string): Promise<CommentRecord[]> {
    await this.assertProduct(productId);
    const comments = await this.prisma.comment.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile: { select: { avatar: true } },
          },
        },
      },
    });

    const authorIds = [...new Set(comments.map((comment) => comment.user.id))];
    const ratings = await this.prisma.rating.findMany({
      where: { productId, userId: { in: authorIds } },
      select: { userId: true, score: true },
    });
    const scoreByUser = new Map(
      ratings.map((rating) => [rating.userId, rating.score]),
    );

    return comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      authorId: comment.user.id,
      author: comment.user.name,
      avatar: comment.user.profile?.avatar ?? null,
      rating: scoreByUser.get(comment.user.id) ?? null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }));
  }

  async createComment(
    productId: string,
    userId: string,
    text: string,
  ): Promise<CommentRecord> {
    const product = await this.assertProduct(productId);
    if (product.ownerId === userId) {
      throw new ForbiddenException('No podés comentar tu propio producto');
    }
    const comment = await this.prisma.comment.create({
      data: { productId, userId, text },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile: { select: { avatar: true } },
          },
        },
      },
    });
    const ownRating = await this.prisma.rating.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { score: true },
    });
    return {
      id: comment.id,
      text: comment.text,
      authorId: comment.user.id,
      author: comment.user.name,
      avatar: comment.user.profile?.avatar ?? null,
      rating: ownRating?.score ?? null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  async removeComment(
    commentId: string,
    userId: string,
    role: string,
  ): Promise<{ id: string }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, userId: true },
    });
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }
    if (comment.userId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException(
        'No tenés permiso para eliminar este comentario',
      );
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { id: commentId };
  }

  async myRating(
    productId: string,
    userId: string,
  ): Promise<{ score: number | null }> {
    await this.assertProduct(productId);
    const rating = await this.prisma.rating.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { score: true },
    });
    return { score: rating?.score ?? null };
  }

  async rate(
    productId: string,
    userId: string,
    score: number,
  ): Promise<RatingSummary> {
    const product = await this.assertProduct(productId);
    if (product.ownerId === userId) {
      throw new ForbiddenException('No podés calificar tu propio producto');
    }

    let summary!: RatingSummary;
    await this.prisma.$transaction(async (tx) => {
      await tx.rating.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId, score },
        update: { score },
      });
      const aggregate = await tx.rating.aggregate({
        where: { productId },
        _avg: { score: true },
        _count: { score: true },
      });
      const rating = Number((aggregate._avg.score ?? 0).toFixed(1));
      const reviewCount = aggregate._count.score;
      summary = { score, rating, reviewCount };
      await tx.product.update({
        where: { id: productId },
        data: { rating, reviewCount },
      });
    });

    return summary;
  }

  private async assertProduct(
    productId: string,
  ): Promise<{ id: string; ownerId: string }> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
      select: { id: true, ownerId: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return product;
  }
}
