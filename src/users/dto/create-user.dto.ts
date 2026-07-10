import { Role } from '../../common/types/admin.types'
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto{
    
    @IsString({ message:'El nombre debe ser un texto'})
    @IsNotEmpty({message:'El nombre es obligatorio'})
    @MinLength(8, { message: 'El nombre debe tener más de 8 caracteres'})
    @MaxLength(50, { message: 'El nombre debe tener menos de 50 caracteres'})
    name: string;
    
    @IsEmail({}, {message: 'Debe ser un mail'})
    @IsNotEmpty({ message:'Email obligatorio'})
    email: string;

    @IsOptional()
    @IsEnum(Role, {
        each: true,
        message: 'Tu rol es'
    })
    role?: Role = Role.USER

    @IsString({ message: 'La contraseña debe ser una cadena de texto'})
    @IsNotEmpty( { message:'La contraseña es obligatoria'})
    @MinLength(8, {message: 'La contraseña debe tener al menos 8 caracteres'})
    @MaxLength(20, {message: 'La contraseña debe ser menos 20 caracteres'})
    password: string;

    @IsString({ message: 'El DNI debe ser una cadena de texto'})
    @IsNotEmpty( { message:'El DNI es obligatorio'})
    @MinLength(8, {message: 'El DNI debe tener al menos 8 caracteres'})
    @MaxLength(20, {message: 'El DNI debe ser menos 20 caracteres'})
    dni: string;
}