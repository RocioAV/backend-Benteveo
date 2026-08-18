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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PhotoProduct, Product } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto): Promise<Product> {
    return this.productsService.create(dto);
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productsService.update(id, dto);
  }

  @Patch(':id')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return this.productsService.remove(id);
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
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<PhotoProduct[]> {
    return this.productsService.uploadPhotos(id, files);
  }

  @Delete('photos')
  @ApiQuery({ name: 'publicId', type: String })
  deletePhoto(
    @Query('publicId') publicId: string,
  ): Promise<{ message: string }> {
    return this.productsService.deletePhoto(publicId);
  }
}
