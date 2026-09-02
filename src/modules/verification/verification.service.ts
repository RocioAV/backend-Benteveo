import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VerificationRequest, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

export interface KycFiles {
  front?: Express.Multer.File[];
  back?: Express.Multer.File[];
  selfie?: Express.Multer.File[];
}

export interface VerificationSubmitResult {
  id: string;
  status: VerificationStatus;
  createdAt: Date;
}

export interface VerificationStatusResult {
  id: string;
  status: VerificationStatus;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async submit(
    userId: string,
    files: KycFiles,
  ): Promise<VerificationSubmitResult> {
    this.assertFilesPresent(files);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (user.isIdentityVerified) {
      throw new ConflictException('El usuario ya está verificado');
    }

    const existing = await this.prisma.verificationRequest.findUnique({
      where: { userId },
    });
    if (existing?.status === VerificationStatus.PENDING) {
      throw new ConflictException(
        'Ya tenés una solicitud de verificación pendiente',
      );
    }

    const [frontResult, backResult, selfieResult] = await Promise.all([
      this.cloudinaryService.uploadImage(files.front[0], {
        folder: 'benteveo/kyc',
      }),
      this.cloudinaryService.uploadImage(files.back[0], {
        folder: 'benteveo/kyc',
      }),
      this.cloudinaryService.uploadImage(files.selfie[0], {
        folder: 'benteveo/kyc',
      }),
    ]);

    const payload = {
      userId,
      frontUrl: frontResult.secure_url,
      backUrl: backResult.secure_url,
      selfieUrl: selfieResult.secure_url,
      status: VerificationStatus.PENDING,
    };

    if (existing) {
      return this.prisma.verificationRequest.update({
        where: { userId },
        data: {
          ...payload,
          reviewNotes: null,
          reviewedBy: null,
          reviewedAt: null,
        },
        select: { id: true, status: true, createdAt: true },
      });
    }

    return this.prisma.verificationRequest.create({
      data: payload,
      select: { id: true, status: true, createdAt: true },
    });
  }

  async getStatus(userId: string): Promise<VerificationStatusResult | null> {
    return this.prisma.verificationRequest.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
        reviewNotes: true,
        reviewedAt: true,
        createdAt: true,
      },
    });
  }

  async findPending(): Promise<
    Array<{
      id: string;
      status: VerificationStatus;
      createdAt: Date;
      frontUrl: string;
      backUrl: string;
      selfieUrl: string;
      user: { email: string; name: string };
    }>
  > {
    return this.prisma.verificationRequest.findMany({
      where: { status: VerificationStatus.PENDING },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(id: string, adminId: string): Promise<VerificationRequest> {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Solicitud de verificación no encontrada');
    }

    await this.prisma.user.update({
      where: { id: request.userId },
      data: { isIdentityVerified: true },
    });

    return this.prisma.verificationRequest.update({
      where: { id },
      data: {
        status: VerificationStatus.APPROVED,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  async reject(
    id: string,
    adminId: string,
    reviewNotes: string,
  ): Promise<VerificationRequest> {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Solicitud de verificación no encontrada');
    }

    return this.prisma.verificationRequest.update({
      where: { id },
      data: {
        status: VerificationStatus.REJECTED,
        reviewNotes,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });
  }

  private assertFilesPresent(
    files: KycFiles,
  ): asserts files is Required<KycFiles> {
    if (!files.front?.[0] || !files.back?.[0] || !files.selfie?.[0]) {
      throw new BadRequestException(
        'Debes adjuntar las imágenes frontal, dorsal y selfie',
      );
    }
  }
}
