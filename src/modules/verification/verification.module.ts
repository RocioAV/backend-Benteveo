import { Module } from '@nestjs/common';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
