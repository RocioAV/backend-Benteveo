import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El formato del email es incorrecto' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  @MaxLength(100, { message: 'El email debe tener menos de 100 caracteres' })
  @MinLength(5, { message: 'El email debe tener al menos 5 caracteres' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' }) 
  @MaxLength(20, { message: 'La contraseña debe tener menos de 20 caracteres' }) 
  password: string;
}