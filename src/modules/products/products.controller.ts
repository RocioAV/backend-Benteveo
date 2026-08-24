import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseFilePipe,
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PhotoProduct, Product } from '@prisma/client';
import { ProductsService } from './products.service';
import { ImageFileValidator } from '../../common/validators/image-file.validator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ): Promise<Product> {
    return this.productsService.create(dto, user.sub);
  }

  @Get()
  @Public()
  findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productsService.update(id, dto, user.sub, user.role);
  }

  @Post(':id/photos')
  @UseInterceptors(FilesInterceptor('photos', 10))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        photos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiParam({ name: 'id', type: String })
  uploadPhotos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [
          new ImageFileValidator({
            allowedMimeTypes: [
              'image/jpeg',
              'image/jpg',
              'image/png',
              'image/webp',
            ],
          }),
        ],
        exceptionFactory: (error) => {
          const message =
            error === 'File is required'
              ? 'Debes adjuntar al menos una imagen'
              : error;
          return new BadRequestException(message);
        },
      }),
    )
    files: Express.Multer.File[],
  ): Promise<PhotoProduct[]> {
    return this.productsService.uploadPhotos(id, files, user.sub, user.role);
  }

  @Delete('photos')
  @ApiQuery({ name: 'publicId', type: String })
  deletePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Query('publicId') publicId: string,
  ): Promise<{ message: string }> {
    return this.productsService.deletePhoto(publicId, user.sub, user.role);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    return this.productsService.remove(id, user.sub, user.role);
  }
}
