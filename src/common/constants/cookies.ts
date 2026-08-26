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

/** `SameSite=Lax`: cubre dev (localhost) y prod (misma registrable domain). */
export const COOKIE_SAME_SITE = 'lax' as const;
