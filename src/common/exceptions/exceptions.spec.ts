import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { ErrorCode } from '../constants/error-codes';
import {
  AdminAlreadyExistsException,
  InvalidUserDataException,
  UserAlreadyExistsException,
  UserNotFoundException,
} from './user-exceptions';
import {
  ForbiddenReservationException,
  InvalidReservationDatesException,
  InvalidReservationStatusException,
  ProductNotAvailableException,
  ProductNotFoundException,
  ReservationAlreadyCancelledException,
  ReservationConflictException,
  ReservationNotFoundException,
} from './reservation-exceptions';

describe('Excepciones migradas a AppException', () => {
  const cases: Array<{
    name: string;
    make: () => AppException;
    code: ErrorCode;
    status: number;
  }> = [
    {
      name: 'UserNotFoundException',
      make: () => new UserNotFoundException('1'),
      code: ErrorCode.RESOURCE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    },
    {
      name: 'UserAlreadyExistsException',
      make: () => new UserAlreadyExistsException('a@b.com'),
      code: ErrorCode.AUTH_EMAIL_TAKEN,
      status: HttpStatus.CONFLICT,
    },
    {
      name: 'InvalidUserDataException',
      make: () => new InvalidUserDataException('bad'),
      code: ErrorCode.VALIDATION_FAILED,
      status: HttpStatus.BAD_REQUEST,
    },
    {
      name: 'AdminAlreadyExistsException',
      make: () => new AdminAlreadyExistsException(),
      code: ErrorCode.RESOURCE_CONFLICT,
      status: HttpStatus.CONFLICT,
    },
    {
      name: 'ReservationNotFoundException',
      make: () => new ReservationNotFoundException('1'),
      code: ErrorCode.RESOURCE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    },
    {
      name: 'ReservationConflictException',
      make: () => new ReservationConflictException('conflicto'),
      code: ErrorCode.RESOURCE_CONFLICT,
      status: HttpStatus.CONFLICT,
    },
    {
      name: 'ProductNotFoundException',
      make: () => new ProductNotFoundException('1'),
      code: ErrorCode.RESOURCE_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    },
    {
      name: 'ProductNotAvailableException',
      make: () => new ProductNotAvailableException('1'),
      code: ErrorCode.RESOURCE_CONFLICT,
      status: HttpStatus.CONFLICT,
    },
    {
      name: 'InvalidReservationDatesException',
      make: () => new InvalidReservationDatesException('fechas'),
      code: ErrorCode.VALIDATION_FAILED,
      status: HttpStatus.BAD_REQUEST,
    },
    {
      name: 'ReservationAlreadyCancelledException',
      make: () => new ReservationAlreadyCancelledException('1'),
      code: ErrorCode.RESOURCE_CONFLICT,
      status: HttpStatus.CONFLICT,
    },
    {
      name: 'InvalidReservationStatusException',
      make: () => new InvalidReservationStatusException('estado'),
      code: ErrorCode.VALIDATION_FAILED,
      status: HttpStatus.BAD_REQUEST,
    },
    {
      name: 'ForbiddenReservationException',
      make: () => new ForbiddenReservationException('no'),
      code: ErrorCode.AUTH_FORBIDDEN,
      status: HttpStatus.FORBIDDEN,
    },
  ];

  it.each(cases)(
    '$name expone code y status correctos',
    ({ make, code, status }) => {
      const exception = make();
      expect(exception).toBeInstanceOf(AppException);
      expect(exception.code).toBe(code);
      expect(exception.getStatus()).toBe(status);
      expect(exception.fields).toBeNull();
    },
  );
});
