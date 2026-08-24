import { Injectable, NotFoundException } from '@nestjs/common';
import { PhotoProduct, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  create(dto: CreateProductDto): Promise<Product> {
    return this.prisma.product.create({ data: dto });
  }

  findAll(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { isDeleted: false },
      include: { photos: true },
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id, isDeleted: false },
      include: { photos: true },
    });
    if (!product) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<Product> {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { isDeleted: true } });
  }

  async uploadPhotos(
    productId: string,
    files: Express.Multer.File[],
  ): Promise<PhotoProduct[]> {
    await this.findOne(productId);

    return Promise.all(
      files.map(async (file) => {
        const result = await this.cloudinaryService.uploadImage(file, {
          folder: `benteveo/products/${productId}`,
        });
        return this.prisma.photoProduct.create({
          data: {
            productId,
            url: result.secure_url,
            publicId: result.public_id,
          },
        });
      }),
    );
  }

  async deletePhoto(publicId: string): Promise<{ message: string }> {
    const photo = await this.prisma.photoProduct.findFirst({
      where: { publicId },
    });
    if (!photo) {
      throw new NotFoundException(
        `Foto con publicId ${publicId} no encontrada`,
      );
    }

    await this.cloudinaryService.deleteImage(publicId);
    await this.prisma.photoProduct.delete({ where: { id: photo.id } });

    return { message: 'Foto eliminada correctamente' };
  }
}
