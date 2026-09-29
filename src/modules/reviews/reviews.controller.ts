import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('products/:id/comments')
  @Public()
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
  ): ReturnType<ReviewsService['listComments']> {
    return this.reviewsService.listComments(id);
  }

  @Post('products/:id/comments')
  createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
  ): ReturnType<ReviewsService['createComment']> {
    return this.reviewsService.createComment(id, user.sub, dto.text);
  }

  @Delete('comments/:id')
  removeComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string }> {
    return this.reviewsService.removeComment(id, user.sub, user.role);
  }

  @Get('products/:id/ratings/mine')
  myRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ score: number | null }> {
    return this.reviewsService.myRating(id, user.sub);
  }

  @Post('products/:id/ratings')
  rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRatingDto,
  ): ReturnType<ReviewsService['rate']> {
    return this.reviewsService.rate(id, user.sub, dto.score);
  }
}
