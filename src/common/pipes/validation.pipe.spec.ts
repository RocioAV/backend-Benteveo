import { BadRequestException } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { ValidationPipe } from './validation.pipe';

class TestDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

describe('ValidationPipe (whitelist + forbidNonWhitelisted)', () => {
  const pipe = new ValidationPipe();

  it('rechaza campos no declarados en el DTO (forbidNonWhitelisted)', async () => {
    const promise = pipe.transform(
      { name: 'Ana', email: 'ana@example.com', isAdmin: true },
      { type: 'body', metatype: TestDto },
    );

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transforma el payload válido a una instancia del DTO', async () => {
    const result = await pipe.transform(
      { name: 'Ana', email: 'ana@example.com' },
      { type: 'body', metatype: TestDto },
    );

    expect(result).toBeInstanceOf(TestDto);
    expect(result.name).toBe('Ana');
    expect(result.email).toBe('ana@example.com');
  });

  it('devuelve el valor crudo para metatipos primitivos (String)', async () => {
    const result = await pipe.transform('valor-crudo', {
      type: 'param',
      metatype: String,
    });

    expect(result).toBe('valor-crudo');
  });

  it('valida las reglas del DTO (p.ej. email inválido rechaza)', async () => {
    const promise = pipe.transform(
      { name: 'Ana', email: 'no-es-un-email' },
      { type: 'body', metatype: TestDto },
    );

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
  });
});
