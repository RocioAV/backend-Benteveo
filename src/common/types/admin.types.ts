import { User as UserModel } from '@prisma/client';

export type User = UserModel;

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
}