import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/user.types';
import { ImageFileValidator } from '../../common/validators/image-file.validator';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'front', maxCount: 1 },
      { name: 'back', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        front: { type: 'string', format: 'binary' },
        back: { type: 'string', format: 'binary' },
        selfie: { type: 'string', format: 'binary' },
      },
    },
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
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
              ? 'Debes adjuntar las imágenes frontal, dorsal y selfie'
              : error;
          return new BadRequestException(message);
        },
      }),
    )
    files: {
      front?: Express.Multer.File[];
      back?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    },
  ) {
    return this.verificationService.submit(user.sub, files);
  }

  @Get()
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.getStatus(user.sub);
  }

  @Get('pending')
  @Roles(Role.ADMIN)
  findPending() {
    return this.verificationService.findPending();
  }

  @Post(':id/approve')
  @Roles(Role.ADMIN)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.verificationService.approve(id, user.sub);
  }

  @Post(':id/reject')
  @Roles(Role.ADMIN)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVerificationDto,
  ) {
    return this.verificationService.reject(id, user.sub, dto.reviewNotes);
  }
}
