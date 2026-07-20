import { HttpException, HttpStatus } from '@nestjs/common';

export class ReservationNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Reserva con ID ${id} no encontrada`, HttpStatus.NOT_FOUND);
  }
}

export class ReservationConflictException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT);
  }
}

export class ProductNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Producto con ID ${id} no encontrado`, HttpStatus.NOT_FOUND);
  }
}

export class ProductNotAvailableException extends HttpException {
  constructor(productId: string) {
    super(`El producto ${productId} no está disponible`, HttpStatus.CONFLICT);
  }
}

export class InvalidReservationDatesException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class ReservationAlreadyCancelledException extends HttpException {
  constructor(id: string) {
    super(`La reserva ${id} ya fue cancelada`, HttpStatus.CONFLICT);
  }
}

export class InvalidReservationStatusException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}

export class ForbiddenReservationException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.FORBIDDEN);
  }
}
