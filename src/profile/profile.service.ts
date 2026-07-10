// src/profile/profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  // Buscar perfil por el ID DEL USUARIO (userId), no el id del perfil
  async findByUserId(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId: userId },
      include: { user: { select: { email: true, roles: true } } } // Opcional: traer email del usuario
    });

    if (!profile) {
        throw new NotFoundException('Perfil no encontrado, ¿el usuario completó el registro?');
    }
    return profile;
  }
  
  // Crear perfil inicial (se llamará desde el registro)
  async createInitialProfile(userId: string) {
      return await this.prisma.profile.create({
          data: { 
            userId,
          }
      });
  }
}