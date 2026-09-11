import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from '../constants/error-codes';

export class PaymentNotFoundException extends AppException {
  constructor(id: string) {
    super(
      ErrorCode.PAYMENT_NOT_FOUND,
      `Pago con ID ${id} no encontrado`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PaymentAlreadyApprovedException extends AppException {
  constructor(reservationId: string) {
    super(
      ErrorCode.PAYMENT_ALREADY_APPROVED,
      `La reserva ${reservationId} ya tiene un pago aprobado`,
      HttpStatus.CONFLICT,
    );
  }
}
