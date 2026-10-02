import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { UserRatingsService } from './user-ratings.service';
import { CreateUserRatingDto } from './dto/create-user-rating.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('reservations')
export class UserRatingsController {
  constructor(private readonly userRatingsService: UserRatingsService) {}

  @Post(':id/user-rating')
  @HttpCode(HttpStatus.CREATED)
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserRatingDto,
  ): ReturnType<UserRatingsService['rate']> {
    return this.userRatingsService.rate(id, user.sub, dto.score);
  }

  @Get(':id/user-rating/mine')
  mine(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<UserRatingsService['mine']> {
    return this.userRatingsService.mine(id, user.sub);
  }
}
