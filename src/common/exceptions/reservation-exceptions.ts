import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from '../constants/error-codes';

export class ReservationNotFoundException extends AppException {
  constructor(id: string) {
    super(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Reserva con ID ${id} no encontrada`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ReservationConflictException extends AppException {
  constructor(message: string) {
    super(ErrorCode.RESOURCE_CONFLICT, message, HttpStatus.CONFLICT);
  }
}

export class ProductNotFoundException extends AppException {
  constructor(id: string) {
    super(
      ErrorCode.RESOURCE_NOT_FOUND,
      `Producto con ID ${id} no encontrado`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ProductNotAvailableException extends AppException {
  constructor(productId: string) {
    super(
      ErrorCode.RESOURCE_CONFLICT,
      `El producto ${productId} no está disponible`,
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidReservationDatesException extends AppException {
  constructor(message: string) {
    super(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST);
  }
}

export class ReservationAlreadyCancelledException extends AppException {
  constructor(id: string) {
    super(
      ErrorCode.RESOURCE_CONFLICT,
      `La reserva ${id} ya fue cancelada`,
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidReservationStatusException extends AppException {
  constructor(message: string) {
    super(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST);
  }
}

export class ForbiddenReservationException extends AppException {
  constructor(message: string) {
    super(ErrorCode.AUTH_FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}
