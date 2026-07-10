import { HttpException, HttpStatus } from '@nestjs/common';

export class UserNotFoundException extends HttpException {
  constructor(id: string | number) {
    super(`Usuario con ID ${id} no encontrado`, HttpStatus.NOT_FOUND);
  }
}

export class UserAlreadyExistsException extends HttpException {
  constructor(email: string) {
    super(`Ya existe un usuario con el email ${email}`, HttpStatus.CONFLICT);
  }
}

export class InvalidUserDataException extends HttpException {
  constructor(message: string) {
    super(`Datos de usuario inválidos: ${message}`, HttpStatus.BAD_REQUEST);
  }
}

export class AdminAlreadyExistsException extends HttpException {
  constructor() {
    super('Ya existe un administrador', HttpStatus.CONFLICT);
  }
}