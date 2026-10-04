import { ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CloudinaryService } from '../cloudinary/cloudinary.service';

const ownedProduct = {
  id: 'prod-1',
  ownerId: 'owner-1',
  isDeleted: false,
  title: 'Taladro',
};

describe('ProductsService', () => {
  const mockProductFindFirst = jest.fn<Promise<any>, [any]>();
  const mockProductUpdate = jest.fn<Promise<any>, [any]>();
  const mockPhotoFindFirst = jest.fn<Promise<any>, [any]>();
  const mockPhotoCreate = jest.fn<Promise<any>, [any]>();
  const mockPhotoDelete = jest.fn<Promise<any>, [any]>();
  const mockUploadImage = jest.fn<Promise<any>, [any, any]>();
  const mockDeleteImage = jest.fn<Promise<any>, [any]>();

  const mockPrisma = {
    product: { findFirst: mockProductFindFirst, update: mockProductUpdate },
    photoProduct: {
      findFirst: mockPhotoFindFirst,
      create: mockPhotoCreate,
      delete: mockPhotoDelete,
    },
  } as unknown as PrismaService;

  const mockCloudinary = {
    uploadImage: mockUploadImage,
    deleteImage: mockDeleteImage,
  } as unknown as CloudinaryService;

  const service = new ProductsService(mockPrisma, mockCloudinary);

  beforeEach(() => {
    jest.clearAllMocks();
    mockProductFindFirst.mockResolvedValue(ownedProduct);
  });

  describe('update', () => {
    it('permite al dueño editar', async () => {
      mockProductUpdate.mockResolvedValue({ ...ownedProduct, title: 'Nuevo' });

      await service.update('prod-1', { title: 'Nuevo' }, 'owner-1', 'USER');

      expect(mockProductUpdate).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { title: 'Nuevo' },
      });
    });

    it('permite a un ADMIN editar aunque no sea dueño', async () => {
      mockProductUpdate.mockResolvedValue({ ...ownedProduct, title: 'Nuevo' });

      await service.update('prod-1', { title: 'Nuevo' }, 'admin-1', 'ADMIN');

      expect(mockProductUpdate).toHaveBeenCalled();
    });

    it('rechaza con 403 a un no-dueño y NO actualiza', async () => {
      const promise = service.update(
        'prod-1',
        { title: 'Hack' },
        'intruso-1',
        'USER',
      );

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toMatchObject({ status: 403 });
      expect(mockProductUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('permite al dueño hacer soft-delete', async () => {
      mockProductUpdate.mockResolvedValue({ ...ownedProduct, isDeleted: true });

      await service.remove('prod-1', 'owner-1', 'USER');

      expect(mockProductUpdate).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isDeleted: true },
      });
    });

    it('rechaza con 403 a un no-dueño', async () => {
      await expect(
        service.remove('prod-1', 'intruso-1', 'USER'),
      ).rejects.toMatchObject({ status: 403 });
      expect(mockProductUpdate).not.toHaveBeenCalled();
    });
  });

  describe('uploadPhotos', () => {
    const files = [{ buffer: Buffer.from('x') }] as Express.Multer.File[];

    it('permite al dueño subir fotos', async () => {
      mockUploadImage.mockResolvedValue({
        secure_url: 'https://cdn/1.jpg',
        public_id: 'pub-1',
      });
      mockPhotoCreate.mockResolvedValue({ id: 'photo-1' });

      await service.uploadPhotos('prod-1', files, 'owner-1', 'USER');

      expect(mockUploadImage).toHaveBeenCalledTimes(1);
      expect(mockPhotoCreate).toHaveBeenCalledTimes(1);
    });

    it('rechaza con 403 a un no-dueño y NO sube nada', async () => {
      await expect(
        service.uploadPhotos('prod-1', files, 'intruso-1', 'USER'),
      ).rejects.toMatchObject({ status: 403 });
      expect(mockUploadImage).not.toHaveBeenCalled();
      expect(mockPhotoCreate).not.toHaveBeenCalled();
    });
  });

  describe('deletePhoto', () => {
    it('permite al dueño eliminar la foto', async () => {
      mockPhotoFindFirst.mockResolvedValue({
        id: 'photo-1',
        publicId: 'pub-1',
        productId: 'prod-1',
      });
      mockDeleteImage.mockResolvedValue(undefined);
      mockPhotoDelete.mockResolvedValue({ id: 'photo-1' });

      const result = await service.deletePhoto('pub-1', 'owner-1', 'USER');

      expect(result).toEqual({ message: 'Foto eliminada correctamente' });
      expect(mockDeleteImage).toHaveBeenCalledWith('pub-1');
      expect(mockPhotoDelete).toHaveBeenCalledWith({
        where: { id: 'photo-1' },
      });
    });

    it('rechaza con 403 a un no-dueño y NO borra en Cloudinary', async () => {
      mockPhotoFindFirst.mockResolvedValue({
        id: 'photo-1',
        publicId: 'pub-1',
        productId: 'prod-1',
      });

      await expect(
        service.deletePhoto('pub-1', 'intruso-1', 'USER'),
      ).rejects.toMatchObject({ status: 403 });
      expect(mockDeleteImage).not.toHaveBeenCalled();
      expect(mockPhotoDelete).not.toHaveBeenCalled();
    });
  });
});
