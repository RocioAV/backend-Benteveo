import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform<any> {
  // value: los datos del request (por ejemplo, el body de un POST).
  // metatype: el tipo del parámetro esperado (por ejemplo, CreateUserDto).
  async transform(value: any, { metatype }: ArgumentMetadata) {
    // Si no hay tipo (metatype), o si el tipo es una clase nativa (String, Number, etc.), no se valida.
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Convierte un object literal ({ name: 'Juan' }) a una instancia real de
    // la clase CreateUserDto, por ejemplo, para que funcione class-validator.
    const object = plainToClass(metatype, value);

    // Valida la instancia según los decoradores como @IsEmail(), @Length(), etc.
    const errors = await validate(object);

    // Extrae los mensajes de validación y lanza un BadRequestException
    // con todos los mensajes concatenados.
    if (errors.length > 0) {
      const errorMessages = errors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('; ');

      throw new BadRequestException(`Error de validación: ${errorMessages}`);
    }

    // Si no pasó nada de lo anterior devuelve lo que le llegó
    return value;
  }

  // Evita validar tipos primitivos
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}