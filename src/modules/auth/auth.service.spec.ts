import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserService } from '../users/user.service';

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

  const mockFindByEmail = jest.fn<Promise<any>, [string]>();
  const mockUserCreate = jest.fn<Promise<any>, [any]>();
  const mockUserService = {
    findByEmail: mockFindByEmail,
    create: mockUserCreate,
  } as unknown as UserService;

  const mockPrisma = {} as unknown as PrismaService;
  const mockJwtService = {} as unknown as JwtService;

  // Constructor con 3 dependencias (sin ProfileService): el Profile lo crea el
  // nested create de UserService.create, no un servicio aparte.
  const service = new AuthService(mockPrisma, mockUserService, mockJwtService);

  beforeEach(() => {
    mockFindByEmail.mockReset();
    mockUserCreate.mockReset();
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
});
