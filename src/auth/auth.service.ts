import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "src/prisma/prisma.service";
import { UserService } from "src/user/user.service";
import { ProfileService } from "src/profile/profile.service";
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from "src/user/dto/create-user.dto";

@Injectable()
export class AuthService{
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private profileService: ProfileService,
    private jwtService: JwtService,
  ) {}

  async signIn(email: string, pass: string): Promise<{ access_token: string }> {
    // 1. Buscamos usuario INCLUYENDO el perfil para saber su plan
    // Asumo que tu userService puede hacer esto, o usa prisma directo aquí si prefieres
    const user = await this.prisma.user.findUnique({
        where: { email },
        include: { profile: true } // <--- CRÍTICO: Traer la relación profile
    });

    if (!user) {
        throw new UnauthorizedException("Correo de usuario incorrecto");
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
        throw new UnauthorizedException("Contraseña incorrecta");
    }

    // 2. Armamos el Payload con el plan
    const payload = {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        plan: user.profile?.plan || 'FREE' 
    };

    return {
        access_token: await this.jwtService.signAsync(payload),
    };
  }

  async signUp(signUpDto: CreateUserDto) {
      // Verificamos si existe
      const userExists = await this.userService.findByEmail(signUpDto.email);
      if (userExists) {
        throw new ConflictException('El email ya está en uso');
      }

      const newUser = await this.userService.create(signUpDto);

      await this.profileService.createInitialProfile(newUser.id);
      
      return newUser;
  }
}
