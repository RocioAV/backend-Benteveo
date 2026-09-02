import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PhotoProduct, Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  create(dto: CreateProductDto, ownerId: string): Promise<Product> {
    return this.prisma.product.create({ data: { ...dto, ownerId } });
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

  async update(
    id: string,
    dto: UpdateProductDto,
    userId: string,
    role: string,
  ): Promise<Product> {
    const product = await this.findOne(id);
    this.assertOwner(
      product,
      userId,
      role,
      'No tenés permiso para editar este producto',
    );
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string, role: string): Promise<Product> {
    const product = await this.findOne(id);
    this.assertOwner(
      product,
      userId,
      role,
      'No tenés permiso para eliminar este producto',
    );
    return this.prisma.product.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async uploadPhotos(
    productId: string,
    files: Express.Multer.File[],
    userId: string,
    role: string,
  ): Promise<PhotoProduct[]> {
    const product = await this.findOne(productId);
    this.assertOwner(
      product,
      userId,
      role,
      'No tenés permiso para subir fotos a este producto',
    );

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

  async deletePhoto(
    publicId: string,
    userId: string,
    role: string,
  ): Promise<{ message: string }> {
    const photo = await this.prisma.photoProduct.findFirst({
      where: { publicId },
    });
    if (!photo) {
      throw new NotFoundException(
        `Foto con publicId ${publicId} no encontrada`,
      );
    }

    const product = await this.findOne(photo.productId);
    this.assertOwner(
      product,
      userId,
      role,
      'No tenés permiso para eliminar fotos de este producto',
    );

    await this.cloudinaryService.deleteImage(publicId);
    await this.prisma.photoProduct.delete({ where: { id: photo.id } });

    return { message: 'Foto eliminada correctamente' };
  }

  /** Lanza 403 si el usuario no es el dueño del producto y no es ADMIN. */
  private assertOwner(
    product: Product,
    userId: string,
    role: string,
    message: string,
  ): void {
    if (product.ownerId !== userId && role !== 'ADMIN') {
      throw new ForbiddenException(message);
    }
  }
}
