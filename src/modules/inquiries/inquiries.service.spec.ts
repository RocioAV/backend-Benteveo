import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { Role } from '../../common/types/user.types';
import { InquiriesService } from './inquiries.service';

describe('InquiriesService', () => {
  const findProduct = jest.fn();
  const upsertInquiry = jest.fn();
  const findInquiries = jest.fn();
  const findInquiry = jest.fn();
  const findMessages = jest.fn();
  const createMessage = jest.fn();
  const prisma = {
    product: { findFirst: findProduct },
    productInquiry: {
      upsert: upsertInquiry,
      findMany: findInquiries,
      findUnique: findInquiry,
    },
    message: { findMany: findMessages, create: createMessage },
  } as unknown as PrismaService;
  const service = new InquiriesService(prisma);
  const requester: AuthenticatedUser = {
    sub: 'requester-1',
    email: 'requester@example.com',
    role: Role.USER,
  };
  const owner: AuthenticatedUser = {
    sub: 'owner-1',
    email: 'owner@example.com',
    role: Role.USER,
  };
  const thirdParty: AuthenticatedUser = {
    sub: 'third-party-1',
    email: 'third-party@example.com',
    role: Role.USER,
  };
  const inquiry = {
    id: 'inquiry-1',
    productId: 'product-1',
    requesterId: 'requester-1',
    createdAt: new Date('2026-10-04T10:00:00.000Z'),
    updatedAt: new Date('2026-10-04T10:00:00.000Z'),
    product: {
      id: 'product-1',
      title: 'Camera',
      isAvailable: true,
      isDeleted: false,
      ownerId: 'owner-1',
      owner: { id: 'owner-1', name: 'Owner', profile: { avatar: null } },
    },
    requester: {
      id: 'requester-1',
      name: 'Requester',
      profile: { avatar: null },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    findProduct.mockResolvedValue({
      id: 'product-1',
      ownerId: 'owner-1',
      isAvailable: true,
    });
    upsertInquiry.mockResolvedValue(inquiry);
    findInquiry.mockResolvedValue(inquiry);
    findInquiries.mockResolvedValue([inquiry]);
    findMessages.mockResolvedValue([
      {
        id: 'message-1',
        inquiryId: 'inquiry-1',
        senderId: 'requester-1',
        content: 'first',
        createdAt: new Date('2026-10-04T10:00:00.000Z'),
        readAt: null,
      },
    ]);
    createMessage.mockResolvedValue({
      id: 'message-2',
      inquiryId: 'inquiry-1',
      senderId: 'requester-1',
      content: 'hello',
      createdAt: new Date('2026-10-04T11:00:00.000Z'),
      readAt: null,
    });
  });

  it('reuses the compound key through an idempotent upsert', async () => {
    const first = await service.create('product-1', requester);
    const second = await service.create('product-1', requester);

    expect(first.id).toBe(second.id);
    expect(upsertInquiry).toHaveBeenCalledTimes(2);
    expect(upsertInquiry).toHaveBeenCalledWith({
      where: {
        productId_requesterId: {
          productId: 'product-1',
          requesterId: 'requester-1',
        },
      },
      create: { productId: 'product-1', requesterId: 'requester-1' },
      update: {},
      select: expect.any(Object),
    });
  });

  it('rejects the product owner from creating a self-inquiry', async () => {
    await expect(service.create('product-1', owner)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(upsertInquiry).not.toHaveBeenCalled();
  });

  it('rejects missing or deleted products before creating an inquiry', async () => {
    findProduct.mockResolvedValueOnce(null);
    await expect(
      service.create('missing-product', requester),
    ).rejects.toThrow('no encontrado');

    findProduct.mockResolvedValueOnce(null);
    await expect(
      service.create('deleted-product', requester),
    ).rejects.toThrow('no encontrado');
    expect(upsertInquiry).not.toHaveBeenCalled();
  });

  it('allows only the requester or current product owner to access an inquiry', async () => {
    await expect(service.getOne('inquiry-1', requester)).resolves.toEqual(
      inquiry,
    );
    await expect(service.getOne('inquiry-1', owner)).resolves.toEqual(inquiry);
    await expect(service.getOne('inquiry-1', thirdParty)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lists inquiries for the requester or current owner with display data', async () => {
    await service.findAll(owner);

    expect(findInquiries).toHaveBeenCalledWith({
      where: {
        product: { isDeleted: false, isAvailable: true },
        OR: [{ requesterId: 'owner-1' }, { product: { ownerId: 'owner-1' } }],
      },
      orderBy: { createdAt: 'desc' },
      select: expect.any(Object),
    });
  });

  it('returns inquiry history ordered ascending and derives the sender from session', async () => {
    await service.getHistory('inquiry-1', requester);
    expect(findMessages).toHaveBeenCalledWith({
      where: { inquiryId: 'inquiry-1' },
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

    await service.createMessage('inquiry-1', requester, '  hello  ');
    expect(createMessage).toHaveBeenCalledWith({
      data: {
        inquiryId: 'inquiry-1',
        senderId: 'requester-1',
        content: 'hello',
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
  });
});
