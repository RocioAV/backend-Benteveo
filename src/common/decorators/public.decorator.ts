import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Decorator que indica que una ruta es pública y no requiere autenticación.
// Util para rutas como login, registro, etc. que no necesitan autenticación.
// Se usa en el AuthGuard para omitir la verificación de token en estas rutas.
