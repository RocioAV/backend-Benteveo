import { User as UserModel } from '@prisma/client';

export type User = UserModel;

/** Usuario sin la contraseña (para cualquier respuesta HTTP). */
export type PublicUser = Omit<User, 'password'>;

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

/**
 * Usuario autenticado inyectado por el AuthGuard.
 * `role` está tipado con el enum unificado; `isIdentityVerified` se
 * rellena a partir de la revalidación contra BD (fase authorization).
 */
export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: Role;
  isIdentityVerified?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
