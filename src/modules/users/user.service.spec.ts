import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserNotFoundException } from '../../common/exceptions/user-exceptions';
import type { PrismaService } from '../../prisma/prisma.service';

/** Forma mínima del argumento que recibe prisma.user.create en UserService.create */
interface MockUserCreateArgs {
  data: {
    email: string;
    password: string;
    name: string;
    role: string;
    dni: string;
    profile: { create: { description: string; phone: string } };
  };
  omit?: { password?: boolean };
}

describe('UserService', () => {
  const dto: CreateUserDto = {
    name: 'Juan Perez',
    email: 'juan@example.com',
    password: 'password123',
    dni: '12345678',
    phone: '1122334455',
  };

  const mockUserCreate = jest.fn<Promise<any>, [MockUserCreateArgs]>();
  const mockUserFindFirst = jest.fn<Promise<any>, [any]>();
  const mockUserFindMany = jest.fn<Promise<any>, [any]>();
  const mockUserUpdate = jest.fn<Promise<any>, [any]>();
  const mockProfileCreate = jest.fn<Promise<any>, [any]>();

  const mockPrisma = {
    user: {
      create: mockUserCreate,
      findFirst: mockUserFindFirst,
      findMany: mockUserFindMany,
      update: mockUserUpdate,
    },
    profile: { create: mockProfileCreate },
  } as unknown as PrismaService;

  const userService = new UserService(mockPrisma);

  beforeEach(() => {
    mockUserCreate.mockReset();
    mockUserFindFirst.mockReset();
    mockUserFindMany.mockReset();
    mockUserUpdate.mockReset();
    mockProfileCreate.mockReset();
  });

  describe('create', () => {
    it('almacena el hash bcrypt tal cual (60 chars, $2b$10$, sin espacios), solicita omit password y crea el Profile vía nested write', async () => {
      mockUserCreate.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'user-1',
          name: data.name,
          email: data.email,
          dni: data.dni,
          role: data.role,
          isIdentityVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await userService.create(dto);

      const { data, omit } = mockUserCreate.mock.calls[0][0];

      // El hash almacenado es EXACTAMENTE el output de bcrypt.hash(password, 10)
      expect(data.password).toMatch(/^\$2b\$10\$/);
      expect(data.password).toHaveLength(60);
      expect(data.password).not.toContain(' ');

      // Se solicita a Prisma omitir la contraseña en la respuesta
      expect(omit).toEqual({ password: true });
      expect(result.password).toBeUndefined();

      // El dueño único del Profile es el nested create; prisma.profile.create NO se llama aparte
      expect(data.profile).toBeDefined();
      expect(data.profile.create).toBeDefined();
      expect(mockProfileCreate).not.toHaveBeenCalled();
    });

    it('convierte un P2002 de Prisma en ConflictException (409)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        {
          code: 'P2002',
          clientVersion: Prisma.prismaVersion.client,
          meta: { target: ['email'] },
        },
      );
      mockUserCreate.mockRejectedValue(prismaError);

      const promise = userService.create(dto);

      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(
        'Ya existe un usuario con el email "juan@example.com"',
      );
      await expect(promise).rejects.toMatchObject({ status: 409 });
      expect(mockProfileCreate).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('solicita omitir password y devuelve la lista sin contraseña', async () => {
      mockUserFindMany.mockResolvedValue([
        { id: 'u1', name: 'A', email: 'a@b.com', role: 'USER' },
      ]);

      const result = await userService.findAll();

      expect(mockUserFindMany).toHaveBeenCalledWith({
        where: { isDeleted: false },
        omit: { password: true },
      });
      expect(result[0].password).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('omite password y lanza UserNotFoundException si no existe', async () => {
      mockUserFindFirst.mockResolvedValue(null);

      await expect(userService.findOne('nope')).rejects.toThrow(
        UserNotFoundException,
      );
      expect(mockUserFindFirst).toHaveBeenCalledWith({
        where: { id: 'nope', isDeleted: false },
        omit: { password: true },
        include: { profile: true },
      });
    });

    it('devuelve el usuario sin password', async () => {
      mockUserFindFirst.mockResolvedValue({
        id: 'u1',
        name: 'A',
        email: 'a@b.com',
        role: 'USER',
        profile: {},
      });

      const result = await userService.findOne('u1');

      expect(result.password).toBeUndefined();
    });
  });

  describe('getUserWithProfile', () => {
    it('omite password', async () => {
      mockUserFindFirst.mockResolvedValue({
        id: 'u1',
        name: 'A',
        email: 'a@b.com',
        role: 'USER',
        profile: {},
      });

      const result = await userService.getUserWithProfile('u1');

      expect(result.password).toBeUndefined();
    });

    it('devuelve null si no existe', async () => {
      mockUserFindFirst.mockResolvedValue(null);

      await expect(userService.getUserWithProfile('nope')).resolves.toBeNull();
    });
  });

  describe('findPublicProfile', () => {
    it('selecciona solo campos públicos (sin email, DNI ni password)', async () => {
      mockUserFindFirst.mockResolvedValue({
        id: 'u1',
        name: 'A',
        role: 'USER',
        isIdentityVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        profile: {},
      });

      const result = await userService.findPublicProfile('u1');

      expect(result.email).toBeUndefined();
      expect(result.dni).toBeUndefined();
      expect(result.password).toBeUndefined();
      expect(mockUserFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            role: true,
            profile: true,
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('hace soft-delete y omite password en la respuesta', async () => {
      mockUserUpdate.mockResolvedValue({
        id: 'u1',
        name: 'A',
        email: 'a@b.com',
        role: 'USER',
        isDeleted: true,
      });

      const result = await userService.remove('u1');

      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isDeleted: true },
        omit: { password: true },
      });
      expect(result.password).toBeUndefined();
    });
  });
});
