import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  parseExpiresInToSeconds,
  resolveSecureFlag,
} from './auth.service';
import { InvalidCredentialsException } from '../../common/exceptions/auth-exceptions';
import { ErrorCode } from '../../common/constants/error-codes';
import { CreateUserDto } from '../users/dto/create-user.dto';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserService } from '../users/user.service';

// Hash bcrypt REAL de "password123" (cost 4 para que el test sea rápido).
const PASSWORD_HASH = '$2b$04$ArdjcxICMzSJaDSYG1Oe9.xBQNbutriXJ7qfNA3sKdMgrt9eIUogS';

describe('AuthService', () => {
  const dto: CreateUserDto = {
    name: 'Juan Perez',
    email: 'juan@example.com',
    password: 'password123',
    dni: '12345678',
    phone: '1122334455',
  };

  const newUser = {
    id: 'user-1',
    name: dto.name,
    email: dto.email,
    password: 'hashed-password',
    dni: dto.dni,
    roles: ['USER'],
    isIdentityVerified: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockUser = {
    id: 'user-1',
    email: 'juan@example.com',
    password: PASSWORD_HASH,
    role: 'USER',
    isDeleted: false,
  };

  const mockFindByEmail = jest.fn<Promise<any>, [string]>();
  const mockUserCreate = jest.fn<Promise<any>, [any]>();
  const mockUserService = {
    findByEmail: mockFindByEmail,
    create: mockUserCreate,
  } as unknown as UserService;

  const mockFindUnique = jest.fn<Promise<any>, [any]>();
  const mockPrisma = {
    user: { findUnique: mockFindUnique },
  } as unknown as PrismaService;

  const mockSignAsync = jest.fn<Promise<string>, [any]>();
  const mockJwtService = {
    signAsync: mockSignAsync,
  } as unknown as JwtService;

  const mockConfigGet = jest.fn<string | undefined, [string]>();
  const mockConfigService = {
    get: mockConfigGet,
  } as unknown as ConfigService;

  const service = new AuthService(
    mockPrisma,
    mockUserService,
    mockJwtService,
    mockConfigService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindByEmail.mockReset();
    mockUserCreate.mockReset();
    mockFindUnique.mockReset();
    mockSignAsync.mockReset();
    mockConfigGet.mockReset();
    mockConfigGet.mockReturnValue('60m');
    mockSignAsync.mockResolvedValue('signed-token');
  });

  describe('signUp', () => {
    it('crea el usuario exactamente una vez y no involucra ProfileService', async () => {
      mockFindByEmail.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue(newUser);

      const result = await service.signUp(dto);

      expect(result).toEqual(newUser);
      expect(mockFindByEmail).toHaveBeenCalledWith(dto.email);
      expect(mockUserCreate).toHaveBeenCalledTimes(1);
      expect(mockUserCreate).toHaveBeenCalledWith(dto);
    });

    it('rechaza con 409 Conflict cuando el email ya está en uso y NO llama a create', async () => {
      mockFindByEmail.mockResolvedValue(newUser);

      const promise = service.signUp(dto);

      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toMatchObject({ status: 409 });
      expect(mockUserCreate).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('inicia sesión y devuelve token + csrf + configuración de cookie (sin password en payload)', async () => {
      mockFindUnique.mockResolvedValue(mockUser);

      const result = await service.signIn('juan@example.com', 'password123');

      expect(result.accessToken).toBe('signed-token');
      expect(result.csrfToken).toEqual(expect.any(String));
      expect(result.csrfToken.length).toBeGreaterThan(0);
      expect(result.maxAgeMs).toBe(3600 * 1000);
      expect(result.secure).toBe(false);
      expect(mockSignAsync).toHaveBeenCalledTimes(1);
      expect(mockSignAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'juan@example.com',
        role: 'USER',
        csrf: result.csrfToken,
      });
      expect(mockSignAsync.mock.calls[0][0]).not.toHaveProperty('password');
    });

    it('rechaza con 401 genérico si el usuario está marcado como eliminado (isDeleted)', async () => {
      mockFindUnique.mockResolvedValue({ ...mockUser, isDeleted: true });

      const promise = service.signIn('juan@example.com', 'password123');

      await expect(promise).rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(mockSignAsync).not.toHaveBeenCalled();
    });

    it('rechaza con 401 genérico si la contraseña es incorrecta', async () => {
      mockFindUnique.mockResolvedValue(mockUser);

      const promise = service.signIn('juan@example.com', 'contraseña-mala');

      await expect(promise).rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(mockSignAsync).not.toHaveBeenCalled();
    });

    it('rechaza con 401 genérico si el email no existe', async () => {
      mockFindUnique.mockResolvedValue(null);

      const promise = service.signIn('nadie@example.com', 'password123');

      await expect(promise).rejects.toBeInstanceOf(InvalidCredentialsException);
      expect(mockSignAsync).not.toHaveBeenCalled();
    });

    it('devuelve el MISMO code/message/status en los tres casos de fallo (anti-enumeración)', async () => {
      const scenarios: Array<{ user: any; pass: string }> = [
        { user: { ...mockUser, isDeleted: true }, pass: 'password123' },
        { user: mockUser, pass: 'contraseña-mala' },
        { user: null, pass: 'password123' },
      ];

      const captured: Array<{
        code: ErrorCode;
        message: string;
        status: number;
      }> = [];

      for (const scenario of scenarios) {
        mockFindUnique.mockResolvedValue(scenario.user);
        try {
          await service.signIn('juan@example.com', scenario.pass);
        } catch (error) {
          const exception = error as InvalidCredentialsException;
          captured.push({
            code: exception.code,
            message: exception.message,
            status: exception.getStatus(),
          });
        }
      }

      expect(captured).toHaveLength(3);
      expect(captured[1]).toEqual(captured[0]);
      expect(captured[2]).toEqual(captured[0]);
      expect(captured[0].code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(captured[0].status).toBe(401);
    });
  });

  describe('parseExpiresInToSeconds', () => {
    it('convierte "60m" a 3600 segundos', () => {
      expect(parseExpiresInToSeconds('60m')).toBe(3600);
    });

    it('convierte "7d" a 604800 segundos', () => {
      expect(parseExpiresInToSeconds('7d')).toBe(604800);
    });

    it('convierte "2h" a 7200 segundos', () => {
      expect(parseExpiresInToSeconds('2h')).toBe(7200);
    });

    it('convierte "3600s" a 3600 segundos', () => {
      expect(parseExpiresInToSeconds('3600s')).toBe(3600);
    });

    it('convierte un número puro como segundos', () => {
      expect(parseExpiresInToSeconds('90')).toBe(90);
    });

    it('cae al fallback seguro (3600) con un valor no reconocido', () => {
      expect(parseExpiresInToSeconds('invalid')).toBe(3600);
      expect(parseExpiresInToSeconds(undefined)).toBe(3600);
    });
  });

  describe('resolveSecureFlag', () => {
    it('solo es true en producción', () => {
      expect(resolveSecureFlag('production')).toBe(true);
    });

    it('es false en desarrollo/test/undefined', () => {
      expect(resolveSecureFlag('development')).toBe(false);
      expect(resolveSecureFlag('test')).toBe(false);
      expect(resolveSecureFlag(undefined)).toBe(false);
    });
  });
});
