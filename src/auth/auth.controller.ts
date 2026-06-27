import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from 'src/common/decorators/public.decorator';
import { ApiBody } from '@nestjs/swagger';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { LoginDto } from './dto/login-dto';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /*Login */
  @HttpCode(HttpStatus.OK)
  @Public()
  @Post('login')
  signIn(@Body() signInDto: LoginDto) { 
    return this.authService.signIn(signInDto.email, signInDto.password);
  }

  /**Registro */
  @Public()
  @ApiBody({ type: CreateUserDto })
  @Post('register')
  signUp(@Body() signUpDto: CreateUserDto) {
    return this.authService.signUp(signUpDto);
  }
  
}
