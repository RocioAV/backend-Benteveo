import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Partial payload for PATCH /user/data-user.
 * Only name, phone and description: email and DNI stay out on purpose
 * (the global ValidationPipe with forbidNonWhitelisted rejects them with 422
 * before they reach the service).
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El nombre debe tener menos de 50 caracteres' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El teléfono es obligatorio' })
  @MinLength(8, { message: 'El teléfono debe tener al menos 8 caracteres' })
  @MaxLength(20, { message: 'El teléfono debe ser menos de 20 caracteres' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(500, {
    message: 'La descripción debe tener menos de 500 caracteres',
  })
  description?: string;
}
