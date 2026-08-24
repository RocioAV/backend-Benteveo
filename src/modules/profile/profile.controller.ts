import { Controller, Get, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get() 
  @UseGuards(AuthGuard)
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return await this.profileService.findByUserId(user.sub);
  }
}