/**
 * DTOs de respuesta con allowlist explícita + mappers puros.
 * Nunca exponen email, DNI, phone ni password en contextos públicos.
 */

/** Forma mínima de entrada: usuario con perfil proyectado a `{ avatar }`. */
export interface UserWithAvatarProfile {
  id: string;
  name: string;
  isIdentityVerified: boolean;
  profile?: { avatar: string | null } | null;
}

/** Perfil público mínimo (GET /user/:id): sin email, DNI, phone ni password. */
export interface PublicProfileDto {
  id: string;
  name: string;
  avatar: string | null;
  isIdentityVerified: boolean;
}

/** Usuario público seguro para embeds (reservas/productos): sin email, DNI, phone ni password. */
export interface PublicUserDto {
  id: string;
  name: string;
  isIdentityVerified: boolean;
  profile: { avatar: string | null } | null;
}

/** Mapea un usuario (con perfil avatar) a su perfil público mínimo. */
export function toPublicProfile(user: UserWithAvatarProfile): PublicProfileDto {
  return {
    id: user.id,
    name: user.name,
    avatar: user.profile?.avatar ?? null,
    isIdentityVerified: user.isIdentityVerified,
  };
}

/** Mapea un usuario a su forma pública segura para embeds (perfil con solo avatar). */
export function toPublicUser(user: UserWithAvatarProfile): PublicUserDto {
  return {
    id: user.id,
    name: user.name,
    isIdentityVerified: user.isIdentityVerified,
    profile: user.profile ? { avatar: user.profile.avatar } : null,
  };
}
