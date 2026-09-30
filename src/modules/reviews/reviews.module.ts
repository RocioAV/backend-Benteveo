import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { UserRatingsController } from './user-ratings.controller';
import { UserRatingsService } from './user-ratings.service';

@Module({
  controllers: [ReviewsController, UserRatingsController],
  providers: [ReviewsService, UserRatingsService],
})
export class ReviewsModule {}
