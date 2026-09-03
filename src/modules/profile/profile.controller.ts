import {
  BadRequestException,
  Controller,
  Get,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ImageFileValidator } from '../../common/validators/image-file.validator';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get() 
  @UseGuards(AuthGuard)
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return await this.profileService.findByUserId(user.sub);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
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
              ? 'Debes adjuntar una imagen'
              : error;
          return new BadRequestException(message);
        },
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.profileService.uploadAvatar(user.sub, file);
  }
}