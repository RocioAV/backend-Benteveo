import { Injectable, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
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

      return newUser as PublicUser;
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

    return user as PublicUser;
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

      return deletedUser as PublicUser;
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
