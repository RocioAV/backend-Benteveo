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

export class PaymentReversalException extends AppException {
  constructor(paymentId: string, detail?: string) {
    super(
      ErrorCode.PAYMENT_REVERSAL_FAILED,
      detail ?? `No se pudo revertir el pago ${paymentId} en Mercado Pago`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}
