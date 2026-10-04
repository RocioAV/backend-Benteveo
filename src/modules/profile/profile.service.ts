// src/profile/profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

  // Buscar perfil por el ID DEL USUARIO (userId), no el id del perfil
  async findByUserId(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: userId },
      include: { user: { select: { email: true, role: true } } }
    });

    if (!profile) {
        throw new NotFoundException('Perfil no encontrado, ¿el usuario completó el registro?');
    }
    return profile;
  }

  /**
   * Sube la foto de perfil (avatar) a Cloudinary y persiste su URL en
   * `Profile.avatar`. Crea el perfil si aún no existe (upsert idempotente).
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatar: string }> {
    const result = await this.cloudinaryService.uploadImage(file, {
      folder: 'benteveo/avatars',
    });

    await this.prisma.profile.upsert({
      where: { userId },
      update: { avatar: result.secure_url },
      create: { userId, avatar: result.secure_url },
    });

    return { avatar: result.secure_url };
  }
}