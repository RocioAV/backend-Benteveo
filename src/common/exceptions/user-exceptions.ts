import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from '../constants/error-codes';

export class UserNotFoundException extends AppException {
  constructor(id: string | number) {
    super(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Usuario con ID ${id} no encontrado`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class UserAlreadyExistsException extends AppException {
  constructor(email: string) {
    super(
      ErrorCode.AUTH_EMAIL_TAKEN,
      `Ya existe un usuario con el email ${email}`,
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidUserDataException extends AppException {
  constructor(message: string) {
    super(
      ErrorCode.VALIDATION_FAILED,
      `Datos de usuario inválidos: ${message}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AdminAlreadyExistsException extends AppException {
  constructor() {
    super(
      ErrorCode.RESOURCE_CONFLICT,
      'Ya existe un administrador',
      HttpStatus.CONFLICT,
    );
  }
}
