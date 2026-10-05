import {
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorCode } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';
import {
  ProductNotAvailableException,
  ProductNotFoundException,
} from '../../common/exceptions/reservation-exceptions';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { PrismaService } from '../../prisma/prisma.service';
import { MAX_MESSAGE_LENGTH } from '../chat/chat.constants';

const INQUIRY_USER_SELECT = {
  id: true,
  name: true,
  profile: { select: { avatar: true } },
} satisfies Prisma.UserSelect;

const INQUIRY_SELECT = {
  id: true,
  productId: true,
  requesterId: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      title: true,
      isAvailable: true,
      isDeleted: true,
      ownerId: true,
      owner: { select: INQUIRY_USER_SELECT },
    },
  },
  requester: { select: INQUIRY_USER_SELECT },
} satisfies Prisma.ProductInquirySelect;

@Injectable()
export class InquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(productId: string, user: AuthenticatedUser) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
      select: { id: true, ownerId: true, isAvailable: true },
    });

    if (!product) {
      throw new ProductNotFoundException(productId);
    }

    if (product.ownerId === user.sub) {
      throw new ForbiddenException(
        'No puedes contactar contigo mismo como dueño del producto',
      );
    }

    if (!product.isAvailable) {
      throw new ProductNotAvailableException(productId);
    }

    return this.prisma.productInquiry.upsert({
      where: {
        productId_requesterId: { productId, requesterId: user.sub },
      },
      create: { productId, requesterId: user.sub },
      update: {},
      select: INQUIRY_SELECT,
    });
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.productInquiry.findMany({
      where: {
        product: { isDeleted: false, isAvailable: true },
        OR: [{ requesterId: user.sub }, { product: { ownerId: user.sub } }],
      },
      orderBy: { createdAt: 'desc' },
      select: INQUIRY_SELECT,
    });
  }

  async getOne(inquiryId: string, user: AuthenticatedUser) {
    const inquiry = await this.getInquiryOrThrow(inquiryId);
    this.assertUserCanAccess(inquiry, user);
    this.assertProductAvailable(inquiry.productId, inquiry.product);
    return inquiry;
  }

  async getHistory(inquiryId: string, user: AuthenticatedUser) {
    await this.getOne(inquiryId, user);

    return this.prisma.message.findMany({
      where: { inquiryId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        inquiryId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
      },
    });
  }

  async createMessage(
    inquiryId: string,
    user: AuthenticatedUser,
    content: string,
  ) {
    await this.getOne(inquiryId, user);
    const normalizedContent = this.normalizeContent(content);

    return this.prisma.message.create({
      data: {
        inquiryId,
        senderId: user.sub,
        content: normalizedContent,
      },
      select: {
        id: true,
        inquiryId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
      },
    });
  }

  async assertParticipant(inquiryId: string, user: AuthenticatedUser) {
    return this.getOne(inquiryId, user);
  }

  private async getInquiryOrThrow(inquiryId: string) {
    const inquiry = await this.prisma.productInquiry.findUnique({
      where: { id: inquiryId },
      select: INQUIRY_SELECT,
    });

    if (!inquiry) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Consulta con ID ${inquiryId} no encontrada`,
        HttpStatus.NOT_FOUND,
      );
    }

    return inquiry;
  }

  private assertUserCanAccess(
    inquiry: Prisma.ProductInquiryGetPayload<{ select: typeof INQUIRY_SELECT }>,
    user: AuthenticatedUser,
  ): void {
    const isRequester = inquiry.requesterId === user.sub;
    const isOwner = inquiry.product.ownerId === user.sub;

    if (!isRequester && !isOwner) {
      throw new ForbiddenException(
        'No tenés permiso para acceder a esta consulta',
      );
    }
  }

  private assertProductAvailable(
    productId: string,
    product: { isDeleted: boolean; isAvailable: boolean },
  ): void {
    if (product.isDeleted) {
      throw new ProductNotFoundException(productId);
    }

    if (!product.isAvailable) {
      throw new ProductNotAvailableException(productId);
    }
  }

  private normalizeContent(content: string): string {
    if (typeof content !== 'string') {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'El contenido del mensaje debe ser texto',
        HttpStatus.BAD_REQUEST,
      );
    }

    const normalizedContent = content.trim();
    if (normalizedContent.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        'El mensaje no puede estar vacío',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
      throw new AppException(
        ErrorCode.VALIDATION_FAILED,
        `El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return normalizedContent;
  }
}
