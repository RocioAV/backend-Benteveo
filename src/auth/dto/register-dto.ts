import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsString({message: "El nombre debe ser una cadena de texto"})
  @MaxLength(40, {message: "El nombre no puede exceder los 40 caracteres"})
  @IsNotEmpty({message: "El nombre es obligatorio"})
name: string;

@IsEmail({}, { message: 'El formato del email es incorrecto' })
@IsNotEmpty({ message: 'El email es obligatorio' })
email: string;

@IsString()
@MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
@MaxLength(20, { message: 'La contraseña debe tener menos de 20 caracteres' })
@IsNotEmpty({ message: 'La contraseña es obligatoria' })
password: string;
}