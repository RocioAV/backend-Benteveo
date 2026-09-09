import { Injectable, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { UserService } from "../users/user.service"; 
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from "../users/dto/create-user.dto";
import { InvalidCredentialsException } from "../../common/exceptions/auth-exceptions";

/** Expiración de sesión por defecto (60 minutos) usada como fallback seguro. */
const DEFAULT_JWT_EXPIRES_IN = '60m';

/**
 * Hash bcrypt dummy contra el que se compara cuando el email no existe. Evita
 * que la ausencia de usuario sea detectable por timing (anti-enumeración).
 */
const DUMMY_HASH = '$2b$10$Y5G9GhatPAU6GzPD9f7Z7uOBFHq4Bc.8I7aWRqDLe3C1DPX1ykL.i';

/** Resultado de un login exitoso. El controller lo usa para setear las cookies. */
export interface SignInResult {
  accessToken: string;
  csrfToken: string;
  /** Max-Age de la cookie en milisegundos (alineado a JWT_EXPIRES_IN). */
  maxAgeMs: number;
  /** `Secure` de la cookie: true solo en producción (HTTPS). */
  secure: boolean;
}

/**
 * Convierte una expiración estilo JWT ("60m", "7d", "2h", "3600s" o un número
 * puro de segundos) a segundos. Valor no reconocido → fallback seguro (3600).
 */
export function parseExpiresInToSeconds(value: string | undefined): number {
  const raw = (value ?? DEFAULT_JWT_EXPIRES_IN).trim();

  const numeric = /^(\d+)$/.exec(raw);
  if (numeric) {
    return Number.parseInt(numeric[1], 10);
  }

  const match = /^(\d+)([smhd])$/i.exec(raw);
  if (match) {
    const amount = Number.parseInt(match[1], 10);
    const factor: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    const unit = match[2].toLowerCase();
    if (factor[unit] !== undefined) {
      return amount * factor[unit];
    }
  }

  return 3600;
}

/**
 * `Secure` de la cookie debe ser condicional a `NODE_ENV`: en producción la
 * app va por HTTPS; en dev va por HTTP local y `Secure` rompería el login.
 */
export function resolveSecureFlag(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

@Injectable()
export class AuthService{
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signIn(email: string, pass: string): Promise<SignInResult> {
    const user = await this.prisma.user.findUnique({
        where: { email },
    });

    // Se compara SIEMPRE (contra hash dummy si no existe el usuario) para que
    // la existencia del email no sea detectable por diferencia de timing.
    const passwordMatches = await bcrypt.compare(
      pass,
      user?.password ?? DUMMY_HASH,
    );

    if (!user || user.isDeleted || !passwordMatches) {
      throw new InvalidCredentialsException();
    }

    const csrfToken = randomUUID();
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      csrf: csrfToken,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      csrfToken,
      maxAgeMs: parseExpiresInToSeconds(
        this.configService.get<string>('JWT_EXPIRES_IN'),
      ) * 1000,
      secure: resolveSecureFlag(process.env.NODE_ENV),
    };
  }

  async signUp(signUpDto: CreateUserDto) {
      const userExists = await this.userService.findByEmail(signUpDto.email);
      if (userExists) {
        throw new ConflictException('El email ya está en uso');
      }

      const dniTaken = await this.userService.findByDni(signUpDto.dni);
      if (dniTaken) {
        throw new ConflictException('El DNI ya está en uso');
      }

      return this.userService.create(signUpDto);
  }
}
