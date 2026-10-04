/**
 * Constantes de la sesión por cookie (auth-session).
 *
 * La sesión viaja en una cookie HttpOnly (`benteveo_session`) y el token CSRF
 * se replica en una cookie no-HttpOnly (`benteveo_csrf`) + claim del JWT. El
 * cliente lo ecoa en el header `X-CSRF-Token` en métodos unsafe.
 */
export const SESSION_COOKIE_NAME = 'benteveo_session';
export const CSRF_COOKIE_NAME = 'benteveo_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** Path de la cookie alineado al prefijo global `api/v1`. */
export const COOKIE_PATH = '/api/v1';

export type CookieSameSite = 'lax' | 'strict' | 'none';

/**
 * `SameSite` de las cookies de sesión, configurable por entorno
 * (`COOKIE_SAME_SITE`).
 *
 * - dev (localhost) y prod con front/back en la misma domain → `lax`
 * - prod con front y back en domains distintos (Vercel + Render) → `none`,
 *   que el navegador solo acepta junto con `secure` (HTTPS).
 *
 * Se resuelve en cada request (no al cargar el módulo) para que el `.env`
 * local cargado por ConfigModule ya esté disponible.
 */
export function resolveCookieSameSite(): CookieSameSite {
  const raw = (process.env.COOKIE_SAME_SITE ?? '').trim().toLowerCase();
  if (raw === 'none' || raw === 'strict' || raw === 'lax') return raw;
  return 'lax';
}

/**
 * `Secure` de la cookie: obligatorio en producción (HTTPS) y **siempre** cuando
 * `SameSite=None`, porque los navegadores descartan esa cookie sin `Secure`.
 */
export function resolveCookieSecure(): boolean {
  return (
    process.env.NODE_ENV === 'production' || resolveCookieSameSite() === 'none'
  );
}
