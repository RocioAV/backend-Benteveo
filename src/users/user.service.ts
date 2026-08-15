import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
import { User} from '../common/types/user.types';
import { Role } from '../common/types/admin.types';
import {
  UserNotFoundException,
  UserAlreadyExistsException,
  // AdminAlreadyExistsException,
} from '../common/exceptions/user-exceptions';
import { PrismaService } from '../prisma/prisma.service';
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
          roles: ['USER'],
          profile: {
            create: {
              description: 'BIOGRAFIA TEMPORAL', 
            },
          },
          dni: createUserDto.dni,  
        },
      });

      return { ...newUser, roles: newUser.roles as Role[] };
    } catch (error) {
      // Manejar error de email duplicado
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new UserAlreadyExistsException(createUserDto.email!);
        }
      }
      throw error;
    }
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll() {
    const users = await this.prisma.user.findMany();
    return users.map((user) => ({ ...user, roles: user.roles as Role[] }));
  }
  

  async getUserWithProfile(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true 
    }
  });

 if (!user) return null;

  const { password, ...result } = user;

  return result;
}


  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { 
        profile: true,
        //   _count: { 
        //   select: { 
        //      reservations: 
        //    } 
        // }
      },
    });

    if (!user) {
      throw new UserNotFoundException(id);
    }

    return { ...user, roles: user.roles as Role[] };
  }
  

  async remove(id: string): Promise<User> {
    try {
      const deletedUser = await this.prisma.user.delete({
        where: { id },
      });

      return { ...deletedUser, roles: deletedUser.roles as Role[] };
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