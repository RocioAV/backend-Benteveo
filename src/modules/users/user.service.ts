import { Injectable, ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
import { User} from '../../common/types/user.types';
import {
  UserNotFoundException,
  UserAlreadyExistsException,
  // AdminAlreadyExistsException,
} from '../../common/exceptions/user-exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client'; 
import * as bcrypt from 'bcryptjs';
// import { equals } from 'class-validator';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      const newUser = await this.prisma.user.create({
        data: {
          email: createUserDto.email,
          password: hashedPassword,
          name: createUserDto.name,
          role: createUserDto.role ?? 'USER',
          profile: {
            create: {
              description: 'BIOGRAFIA TEMPORAL', 
              phone: createUserDto.phone,
            },
          },
          dni: createUserDto.dni,  
        },
      });

      return newUser as User;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as string[]) ?? [];
          const fieldMessages: string[] = [];
          if (target.includes('email')) {
            fieldMessages.push(`el email "${createUserDto.email}"`);
          }
          if (target.includes('dni')) {
            fieldMessages.push(`el DNI "${createUserDto.dni}"`);
          }
          throw new ConflictException(`Ya existe un usuario con ${fieldMessages.join(' y ')}`);
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

  async findAll() {
    return await this.prisma.user.findMany({
      where: { isDeleted: false },
    });
  }
  

  async getUserWithProfile(userId: string) {
  const user = await this.prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    include: {
      profile: true 
    }
  });

 if (!user) return null;

  const { password, ...result } = user;

  return result;
}


  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, isDeleted: false },
      include: { 
        profile: true,
      },
    });

    if (!user) {
      throw new UserNotFoundException(id);
    }

    return user as User;
  }
  

  async remove(id: string): Promise<User> {
    try {
      const deletedUser = await this.prisma.user.update({
        where: { id },
        data: { isDeleted: true },
      });

      return deletedUser as User;
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
