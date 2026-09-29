import { Injectable, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
import { PublicUser } from '../../common/types/user.types';
import { Role } from '../../common/types/user.types';
import { toPublicProfile, PublicProfileDto } from './dto/public-user.dto';
import {
  UserNotFoundException,
  // AdminAlreadyExistsException,
} from '../../common/exceptions/user-exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      const newUser = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          password: hashedPassword,
          name: createUserDto.name,
          role: Role.USER,
          profile: {
            create: {
              description: 'BIOGRAFIA TEMPORAL',
              phone: createUserDto.phone,
            },
          },
          dni: createUserDto.dni,
        },
        omit: { password: true },
      });

      return newUser;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) ?? [];
          const fieldMessages: string[] = [];
          if (target.includes('email')) {
            fieldMessages.push('el email');
          }
          if (target.includes('dni')) {
            fieldMessages.push('el DNI');
          }
          const description =
            fieldMessages.length > 0 ? fieldMessages.join(' y ') : 'esos datos';
          throw new ConflictException(
            `Ya existe un usuario con ${description}`,
          );
        }
      }
      throw error;
    }
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, isDeleted: false },
    });
  }

  async findByDni(dni: string) {
    return this.prisma.user.findFirst({
      where: { dni, isDeleted: false },
    });
  }

  async findAll() {
    return await this.prisma.user.findMany({
      where: { isDeleted: false },
      omit: { password: true },
    });
  }

  async findByDniPublic(dni: string) {
    const user = await this.prisma.user.findFirst({
      where: { dni, isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        dni: true,
        isIdentityVerified: true,
        createdAt: true,
      },
    });
    return user;
  }

  async findRecent(limit = 10) {
    return this.prisma.user.findMany({
      where: { isDeleted: false },
      omit: { password: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUserWithProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      omit: { password: true },
      include: {
        profile: true,
      },
    });

    if (!user) return null;

    return user;
  }

  /**
   * Actualización parcial del propio usuario: `name` vive en User y
   * `phone`/`description` en Profile, escritos en una sola transacción.
   * Profile.userId es único, así que se hace upsert para tolerar usuarios
   * sin fila de perfil. Un body vacío no escribe nada.
   */
  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    const { name, phone, description } = dto;

    const shouldUpdateUser = name !== undefined;
    const shouldUpdateProfile =
      phone !== undefined || description !== undefined;

    if (shouldUpdateUser || shouldUpdateProfile) {
      await this.prisma.$transaction(async (tx) => {
        if (shouldUpdateUser) {
          await tx.user.update({
            where: { id: userId },
            data: { name },
          });
        }

        if (shouldUpdateProfile) {
          const profileData = {
            ...(phone !== undefined ? { phone } : {}),
            ...(description !== undefined ? { description } : {}),
          };

          await tx.profile.upsert({
            where: { userId },
            update: profileData,
            create: { userId, ...profileData },
          });
        }
      });
    }

    return this.getUserWithProfile(userId);
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, isDeleted: false },
      omit: { password: true },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new UserNotFoundException(id);
    }

    return user;
  }

  /** Perfil público de un usuario: sin email, DNI, phone ni contraseña. */
  async findPublicProfile(id: string): Promise<PublicProfileDto> {
    const user = await this.prisma.user.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true,
        name: true,
        isIdentityVerified: true,
        profile: { select: { avatar: true } },
      },
    });

    if (!user) {
      throw new UserNotFoundException(id);
    }

    return toPublicProfile(user);
  }

  async remove(id: string): Promise<PublicUser> {
    try {
      const deletedUser = await this.prisma.user.update({
        where: { id },
        data: { isDeleted: true },
        omit: { password: true },
      });

      return deletedUser;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new UserNotFoundException(id);
        }
      }
      throw error;
    }
  }
}
