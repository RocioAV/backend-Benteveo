import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Traduce los errores conocidos de Prisma a respuestas HTTP con mensajes en
 * español. Los códigos desconocidos caen en 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = 'Ya existe un recurso con esos datos (registro duplicado)';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Recurso no encontrado';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message =
          'No se puede procesar: existe una referencia inválida (violación de clave foránea)';
        break;
      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Error en la base de datos';
        break;
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.code,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
