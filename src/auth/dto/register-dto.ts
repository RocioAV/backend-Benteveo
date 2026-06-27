import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty} from 'class-validator';

export class RegisterDto {
  
@IsString({message: "El nombre debe ser una cadena de texto"})
@MaxLength(40, {message: "El nombre no puede exceder los 40 caracteres"})
name: string;

@IsEmail({}, { message: 'El formato del email es incorrecto' })
@IsNotEmpty({ message: 'El email es obligatorio' })
email: string;

@IsString()
@MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
password: string;
}