import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Product } from '@prisma/client';
import { FavoritesService } from './favorites.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  listProducts(@CurrentUser() user: AuthenticatedUser): Promise<Product[]> {
    return this.favoritesService.listProducts(user.sub);
  }

  @Get('ids')
  listIds(@CurrentUser() user: AuthenticatedUser): Promise<string[]> {
    return this.favoritesService.listIds(user.sub);
  }

  @Post(':productId')
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<{ isFavorite: boolean }> {
    return this.favoritesService.add(user.sub, productId);
  }

  @Delete(':productId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<{ isFavorite: boolean }> {
    return this.favoritesService.remove(user.sub, productId);
  }
}
