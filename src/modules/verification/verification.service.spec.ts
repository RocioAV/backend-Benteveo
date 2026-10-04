import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { VerificationService, KycFiles } from './verification.service';
import { VerificationStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CloudinaryService } from '../cloudinary/cloudinary.service';

const mockFile = {
  buffer: Buffer.from('x'),
  mimetype: 'image/jpeg',
} as Express.Multer.File;

const fullFiles: KycFiles = {
  front: [mockFile],
  back: [mockFile],
  selfie: [mockFile],
};

describe('VerificationService', () => {
  const mockUserFindUnique = jest.fn<Promise<any>, [any]>();
  const mockUserUpdate = jest.fn<Promise<any>, [any]>();
  const mockVerificationFindUnique = jest.fn<Promise<any>, [any]>();
  const mockVerificationFindMany = jest.fn<Promise<any>, [any]>();
  const mockVerificationCreate = jest.fn<Promise<any>, [any]>();
  const mockVerificationUpdate = jest.fn<Promise<any>, [any]>();
  const mockUploadImage = jest.fn<Promise<any>, [any, any]>();

  const mockPrisma = {
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    verificationRequest: {
      findUnique: mockVerificationFindUnique,
      findMany: mockVerificationFindMany,
      create: mockVerificationCreate,
      update: mockVerificationUpdate,
    },
  } as unknown as PrismaService;

  const mockCloudinary = {
    uploadImage: mockUploadImage,
  } as unknown as CloudinaryService;

  const service = new VerificationService(mockPrisma, mockCloudinary);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadImage.mockResolvedValue({
      secure_url: 'https://cdn/image.jpg',
      public_id: 'pub',
    });
  });

  describe('submit', () => {
    it('crea una solicitud PENDING cuando no existe una previa', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        isIdentityVerified: false,
      });
      mockVerificationFindUnique.mockResolvedValue(null);
      mockVerificationCreate.mockResolvedValue({
        id: 'req-1',
        status: VerificationStatus.PENDING,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });

      const result = await service.submit('user-1', fullFiles);

      expect(result.status).toBe(VerificationStatus.PENDING);
      expect(mockVerificationCreate).toHaveBeenCalledTimes(1);
      expect(mockUploadImage).toHaveBeenCalledTimes(3);
      expect(mockUploadImage).toHaveBeenCalledWith(fullFiles.front[0], {
        folder: 'benteveo/kyc',
      });
    });

    it('vuelve a PENDING cuando la solicitud anterior fue REJECTED', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        isIdentityVerified: false,
      });
      mockVerificationFindUnique.mockResolvedValue({
        id: 'req-1',
        status: VerificationStatus.REJECTED,
      });
      mockVerificationUpdate.mockResolvedValue({
        id: 'req-1',
        status: VerificationStatus.PENDING,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });

      const result = await service.submit('user-1', fullFiles);

      expect(result.status).toBe(VerificationStatus.PENDING);
      expect(mockVerificationUpdate).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          userId: 'user-1',
          frontUrl: 'https://cdn/image.jpg',
          backUrl: 'https://cdn/image.jpg',
          selfieUrl: 'https://cdn/image.jpg',
          status: VerificationStatus.PENDING,
          reviewNotes: null,
          reviewedBy: null,
          reviewedAt: null,
        },
        select: { id: true, status: true, createdAt: true },
      });
      expect(mockVerificationCreate).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si ya existe una solicitud PENDING', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        isIdentityVerified: false,
      });
      mockVerificationFindUnique.mockResolvedValue({
        id: 'req-1',
        status: VerificationStatus.PENDING,
      });

      await expect(service.submit('user-1', fullFiles)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mockUploadImage).not.toHaveBeenCalled();
      expect(mockVerificationCreate).not.toHaveBeenCalled();
      expect(mockVerificationUpdate).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el usuario ya está verificado', async () => {
      mockUserFindUnique.mockResolvedValue({
        id: 'user-1',
        isIdentityVerified: true,
      });

      await expect(service.submit('user-1', fullFiles)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mockVerificationFindUnique).not.toHaveBeenCalled();
      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('rechaza con 400 si faltan archivos', async () => {
      await expect(
        service.submit('user-1', { front: [mockFile] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockUploadImage).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('devuelve null cuando no hay solicitud', async () => {
      mockVerificationFindUnique.mockResolvedValue(null);

      const result = await service.getStatus('user-1');

      expect(result).toBeNull();
    });

    it('nunca expone las URLs de los documentos', async () => {
      mockVerificationFindUnique.mockResolvedValue({
        id: 'req-1',
        status: VerificationStatus.PENDING,
        reviewNotes: null,
        reviewedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });

      const result = await service.getStatus('user-1');

      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('frontUrl');
      expect(result).not.toHaveProperty('backUrl');
      expect(result).not.toHaveProperty('selfieUrl');
    });
  });

  describe('approve', () => {
    it('setea APPROVED y marca al usuario como verificado', async () => {
      mockVerificationFindUnique.mockResolvedValue({
        id: 'req-1',
        userId: 'user-1',
      });
      mockUserUpdate.mockResolvedValue({
        id: 'user-1',
        isIdentityVerified: true,
      });
      mockVerificationUpdate.mockResolvedValue({
        id: 'req-1',
        status: VerificationStatus.APPROVED,
      });

      const result = await service.approve('req-1', 'admin-1');

      expect(result.status).toBe(VerificationStatus.APPROVED);
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isIdentityVerified: true },
      });
      const updateCall = mockVerificationUpdate.mock.calls[0][0] as {
        where: { id: string };
        data: {
          status: VerificationStatus;
          reviewedBy: string;
          reviewedAt: Date;
        };
      };
      expect(updateCall.where).toEqual({ id: 'req-1' });
      expect(updateCall.data.status).toBe(VerificationStatus.APPROVED);
      expect(updateCall.data.reviewedBy).toBe('admin-1');
      expect(updateCall.data.reviewedAt).toBeInstanceOf(Date);
    });

    it('rechaza con 404 si la solicitud no existe', async () => {
      mockVerificationFindUnique.mockResolvedValue(null);

      await expect(service.approve('req-1', 'admin-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockUserUpdate).not.toHaveBeenCalled();
      expect(mockVerificationUpdate).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('setea REJECTED con las notas', async () => {
      mockVerificationFindUnique.mockResolvedValue({
        id: 'req-1',
        userId: 'user-1',
      });
      mockVerificationUpdate.mockResolvedValue({
        id: 'req-1',
        status: VerificationStatus.REJECTED,
        reviewNotes: 'Documento ilegible',
      });

      const result = await service.reject(
        'req-1',
        'admin-1',
        'Documento ilegible',
      );

      expect(result.status).toBe(VerificationStatus.REJECTED);
      const updateCall = mockVerificationUpdate.mock.calls[0][0] as {
        where: { id: string };
        data: {
          status: VerificationStatus;
          reviewNotes: string;
          reviewedBy: string;
          reviewedAt: Date;
        };
      };
      expect(updateCall.where).toEqual({ id: 'req-1' });
      expect(updateCall.data.status).toBe(VerificationStatus.REJECTED);
      expect(updateCall.data.reviewNotes).toBe('Documento ilegible');
      expect(updateCall.data.reviewedBy).toBe('admin-1');
      expect(updateCall.data.reviewedAt).toBeInstanceOf(Date);
    });

    it('rechaza con 404 si la solicitud no existe', async () => {
      mockVerificationFindUnique.mockResolvedValue(null);

      await expect(
        service.reject('req-1', 'admin-1', 'Documento ilegible'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockVerificationUpdate).not.toHaveBeenCalled();
    });
  });
});
