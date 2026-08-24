import { Prisma } from '@prisma/client';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserAlreadyExistsException } from '../common/exceptions/user-exceptions';
import type { PrismaService } from '../prisma/prisma.service';

/** Forma mínima del argumento que recibe prisma.user.create en UserService.create */
interface MockUserCreateArgs {
  data: {
    email: string;
    password: string;
    name: string;
    roles: string[];
    dni: string;
    profile: { create: { description: string } };
  };
}

describe('UserService', () => {
  const dto: CreateUserDto = {
    name: 'Juan Perez',
    email: 'juan@example.com',
    password: 'password123',
    dni: '12345678',
  };

  const mockUserCreate = jest.fn<Promise<any>, [MockUserCreateArgs]>();
  const mockUserFindUnique = jest.fn<Promise<any>, [any]>();
  const mockProfileCreate = jest.fn<Promise<any>, [any]>();

  const mockPrisma = {
    user: { create: mockUserCreate, findUnique: mockUserFindUnique },
    profile: { create: mockProfileCreate },
  } as unknown as PrismaService;

  const userService = new UserService(mockPrisma);

  beforeEach(() => {
    mockUserCreate.mockReset();
    mockUserFindUnique.mockReset();
    mockProfileCreate.mockReset();
  });

  describe('create', () => {
    it('almacena el hash bcrypt tal cual (60 chars, $2b$10$, sin espacios) y crea el Profile solo vía nested write', async () => {
      mockUserCreate.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'user-1',
          name: data.name,
          email: data.email,
          password: data.password,
          dni: data.dni,
          roles: data.roles,
          isIdentityVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const result = await userService.create(dto);

      const { data } = mockUserCreate.mock.calls[0][0];

      // El hash almacenado es EXACTAMENTE el output de bcrypt.hash(password, 10)
      expect(data.password).toMatch(/^\$2b\$10\$/);
      expect(data.password).toHaveLength(60);
      expect(data.password).not.toContain(' ');
      expect(result.password).toBe(data.password);

      // El dueño único del Profile es el nested create; prisma.profile.create NO se llama aparte
      expect(data.profile).toBeDefined();
      expect(data.profile.create).toBeDefined();
      expect(mockProfileCreate).not.toHaveBeenCalled();
    });

    it('convierte un P2002 de Prisma en UserAlreadyExistsException (409)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: Prisma.prismaVersion.client },
      );
      mockUserCreate.mockRejectedValue(prismaError);

      const promise = userService.create(dto);

      await expect(promise).rejects.toThrow(UserAlreadyExistsException);
      await expect(promise).rejects.toThrow(
        'Ya existe un usuario con el email juan@example.com',
      );
      await expect(promise).rejects.toMatchObject({ status: 409 });
      expect(mockProfileCreate).not.toHaveBeenCalled();
    });
  });
});
