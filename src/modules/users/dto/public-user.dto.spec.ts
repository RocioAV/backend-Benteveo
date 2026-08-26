import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import {
  toPublicProfile,
  toPublicUser,
  PublicProfileDto,
  PublicUserDto,
} from './public-user.dto';

describe('PublicUserDto / PublicProfileDto (allowlist)', () => {
  describe('CreateUserDto sin rol', () => {
    it('rechaza el campo `role` con whitelist + forbidNonWhitelisted', async () => {
      const dto = plainToInstance(CreateUserDto, {
        name: 'Juan Perez',
        email: 'juan@example.com',
        password: 'password123',
        dni: '12345678',
        phone: '1122334455',
        role: 'ADMIN',
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('acepta un payload válido sin rol', async () => {
      const dto = plainToInstance(CreateUserDto, {
        name: 'Juan Perez',
        email: 'juan@example.com',
        password: 'password123',
        dni: '12345678',
        phone: '1122334455',
      });

      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      expect(errors).toHaveLength(0);
    });
  });

  describe('toPublicProfile', () => {
    const source = {
      id: 'u1',
      name: 'Ana',
      isIdentityVerified: true,
      profile: { avatar: 'https://cdn/avatar.png' },
      // PII que el mapper NUNCA debe exponer:
      email: 'ana@example.com',
      dni: '12345678',
      phone: '1122334455',
      password: 'hash',
    };

    it('aplana avatar y omite email/dni/phone/password', () => {
      const result: PublicProfileDto = toPublicProfile(source as any);

      expect(result).toEqual({
        id: 'u1',
        name: 'Ana',
        avatar: 'https://cdn/avatar.png',
        isIdentityVerified: true,
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('dni');
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('password');
    });

    it('devuelve avatar null cuando el perfil tiene avatar null', () => {
      const result = toPublicProfile({
        id: 'u2',
        name: 'Beto',
        isIdentityVerified: false,
        profile: { avatar: null },
      });

      expect(result.avatar).toBeNull();
    });

    it('devuelve avatar null cuando no hay perfil', () => {
      const result = toPublicProfile({
        id: 'u3',
        name: 'Carlos',
        isIdentityVerified: false,
        profile: null,
      });

      expect(result.avatar).toBeNull();
    });
  });

  describe('toPublicUser', () => {
    it('conserva profile con solo avatar y omite email/dni/phone/password', () => {
      const result: PublicUserDto = toPublicUser({
        id: 'u1',
        name: 'Ana',
        isIdentityVerified: true,
        profile: { avatar: 'https://cdn/avatar.png' },
        email: 'ana@example.com',
        dni: '12345678',
        phone: '1122334455',
      } as any);

      expect(result).toEqual({
        id: 'u1',
        name: 'Ana',
        isIdentityVerified: true,
        profile: { avatar: 'https://cdn/avatar.png' },
      });
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('dni');
    });

    it('conserva profile null cuando no hay perfil', () => {
      const result = toPublicUser({
        id: 'u2',
        name: 'Beto',
        isIdentityVerified: false,
        profile: null,
      });

      expect(result.profile).toBeNull();
    });
  });
});
