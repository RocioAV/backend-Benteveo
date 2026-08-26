import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, resolveSecureFlag } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login-dto';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  COOKIE_PATH,
  COOKIE_SAME_SITE,
} from '../../common/constants/cookies';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login: emite la cookie HttpOnly `benteveo_session` (JWT) + la cookie
   * no-HttpOnly `benteveo_csrf`. NO retorna token en el body (204 vacío).
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  @Post('login')
  async signIn(
    @Body() signInDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { accessToken, csrfToken, maxAgeMs, secure } =
      await this.authService.signIn(signInDto.email, signInDto.password);

    res.cookie(SESSION_COOKIE_NAME, accessToken, {
      httpOnly: true,
      sameSite: COOKIE_SAME_SITE,
      secure,
      path: COOKIE_PATH,
      maxAge: maxAgeMs,
    });

    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      sameSite: COOKIE_SAME_SITE,
      secure,
      path: COOKIE_PATH,
      maxAge: maxAgeMs,
    });
  }

  /**
   * Logout: expira/limpia ambas cookies. La sesión queda inservible de
   * inmediato (el cliente pierde el JWT; posterior reuso → 401).
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Public()
  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): void {
    const secure = resolveSecureFlag(process.env.NODE_ENV);

    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: COOKIE_SAME_SITE,
      secure,
      path: COOKIE_PATH,
    });

    res.clearCookie(CSRF_COOKIE_NAME, {
      httpOnly: false,
      sameSite: COOKIE_SAME_SITE,
      secure,
      path: COOKIE_PATH,
    });
  }

  /**
   * Expone el token CSRF de la sesión actual (eco de la cookie no-HttpOnly).
   * Método GET (safe) → no requiere CSRF. `null` si aún no hay sesión.
   */
  @Public()
  @Get('csrf')
  getCsrfToken(@Req() req: Request): { csrfToken: string | null } {
    return { csrfToken: req.cookies?.[CSRF_COOKIE_NAME] ?? null };
  }

  /**Registro */
  @Public()
  @Post('register')
  signUp(@Body() signUpDto: CreateUserDto) {
    return this.authService.signUp(signUpDto);
  }
}
