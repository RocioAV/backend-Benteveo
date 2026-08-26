import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from '../constants/error-codes';

describe('AppException', () => {
  it('extiende HttpException y expone code, fields y status', () => {
    const exception = new AppException(
      ErrorCode.RESOURCE_NOT_FOUND,
      'No encontrado',
      HttpStatus.NOT_FOUND,
      { campo: 'mensaje' },
    );

    expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(exception.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(exception.fields).toEqual({ campo: 'mensaje' });
  });

  it('tiene fields null por defecto', () => {
    const exception = new AppException(
      ErrorCode.INTERNAL_ERROR,
      'Error interno',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );

    expect(exception.fields).toBeNull();
  });

  it('expone el body {code,message,fields} vía getResponse', () => {
    const exception = new AppException(
      ErrorCode.AUTH_FORBIDDEN,
      'Prohibido',
      HttpStatus.FORBIDDEN,
    );

    expect(exception.getResponse()).toEqual({
      code: ErrorCode.AUTH_FORBIDDEN,
      message: 'Prohibido',
      fields: null,
    });
  });
});

describe('ErrorCode', () => {
  it('define los 10 códigos estables del contrato de error', () => {
    expect(Object.values(ErrorCode).sort()).toEqual(
      [
        'AUTH_EMAIL_TAKEN',
        'AUTH_FORBIDDEN',
        'AUTH_INVALID_CREDENTIALS',
        'AUTH_KYC_REQUIRED',
        'AUTH_UNAUTHORIZED',
        'CSRF_TOKEN_INVALID',
        'INTERNAL_ERROR',
        'RESOURCE_CONFLICT',
        'RESOURCE_NOT_FOUND',
        'VALIDATION_FAILED',
      ].sort(),
    );
  });
});
