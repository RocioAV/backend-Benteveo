import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { AuthGuard } from 'src/common/guards/auth.guard';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get() 
  @UseGuards(AuthGuard)
  async getMyProfile(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return await this.profileService.findByUserId(userId);
  }
}