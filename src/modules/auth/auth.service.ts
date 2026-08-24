import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../prisma/prisma.service";
import { UserService } from "../users/user.service"; 
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from "../users/dto/create-user.dto";

@Injectable()
export class AuthService{
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.prisma.user.findUnique({
        where: { email },
        include: { profile: true } 
    });

    if (!user) {
        throw new UnauthorizedException("Correo de usuario incorrecto");
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
        throw new UnauthorizedException("Contraseña incorrecta");
    }

    const payload = {
        sub: user.id,
        email: user.email,
        role: user.role,
    };

    return {
        access_token: await this.jwtService.signAsync(payload),
    };
  }

  async signUp(signUpDto: CreateUserDto) {
      const userExists = await this.userService.findByEmail(signUpDto.email);
      if (userExists) {
        throw new ConflictException('El email ya está en uso');
      }

<<<<<<< HEAD:src/auth/auth.service.ts
      return this.userService.create(signUpDto);
=======
      const newUser = await this.userService.create(signUpDto);
      
      return newUser;
>>>>>>> dev:src/modules/auth/auth.service.ts
  }
}
