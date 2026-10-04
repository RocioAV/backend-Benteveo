import { HttpStatus } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
import { ValidationPipe } from './validation.pipe';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes';

class TestDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;
}

describe('ValidationPipe (whitelist + forbidNonWhitelisted + contrato de error)', () => {
  const pipe = new ValidationPipe();

  it('rechaza campos no declarados con 422 VALIDATION_FAILED y fields por campo', async () => {
    const promise = pipe.transform(
      { name: 'Ana', email: 'ana@example.com', isAdmin: true },
      { type: 'body', metatype: TestDto },
    );

    await expect(promise).rejects.toBeInstanceOf(AppException);
    await expect(promise).rejects.toMatchObject({
      status: 422,
      code: ErrorCode.VALIDATION_FAILED,
    });
    await expect(promise).rejects.toMatchObject({
      fields: expect.objectContaining({ isAdmin: expect.any(String) }),
    });
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

  it('devuelve fields estructurado por campo para email inválido', async () => {
    const promise = pipe.transform(
      { name: 'Ana', email: 'no-es-un-email' },
      { type: 'body', metatype: TestDto },
    );

    await expect(promise).rejects.toBeInstanceOf(AppException);
    await expect(promise).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ErrorCode.VALIDATION_FAILED,
      fields: expect.objectContaining({
        email: expect.stringContaining('email'),
      }),
    });
  });
});
