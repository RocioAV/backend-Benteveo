import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes';

/** Shape del contrato de error: toda respuesta de error lo cumple. */
export interface ErrorBody {
  code: ErrorCode;
  message: string;
  fields: Record<string, string> | null;
  requestId: string;
}

interface NormalizedError {
  status: number;
  code: ErrorCode;
  message: string;
  fields: Record<string, string> | null;
}

/**
 * Filtro catch-all ÚNICO.
 *
 * Normaliza toda excepción (HttpException, AppException, errores Prisma y
 * genéricos) al shape `{ code, message, fields, requestId }`. Los errores
 * desconocidos caen en 500 `INTERNAL_ERROR` sin filtrar stack/query/detalles.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalized = normalizeException(exception);
    const requestId = resolveRequestId(request);

    const body: ErrorBody = {
      code: normalized.code,
      message: normalized.message,
      fields: normalized.fields,
      requestId,
    };

    response.status(normalized.status).json(body);
  }
}

/** Normaliza una excepción a `{status,code,message,fields}`. Exportada para test. */
export function normalizeException(exception: unknown): NormalizedError {
  if (exception instanceof AppException) {
    return {
      status: exception.getStatus(),
      code: exception.code,
      message: extractMessage(exception),
      fields: exception.fields,
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(exception.code);
  }

  if (exception instanceof HttpException) {
    return {
      status: exception.getStatus(),
      code: mapStatusToCode(exception.getStatus()),
      message: extractMessage(exception),
      fields: null,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Error interno del servidor',
    fields: null,
  };
}

/** Deriva un `code` estable a partir del status HTTP de una HttpException genérica. */
function mapStatusToCode(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.AUTH_UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.AUTH_FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.RESOURCE_NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ErrorCode.RESOURCE_CONFLICT;
    case HttpStatus.UNPROCESSABLE_ENTITY:
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.VALIDATION_FAILED;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

/** Mapea los errores Prisma conocidos a status + code estables. */
function mapPrismaError(prismaCode: string): NormalizedError {
  switch (prismaCode) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.AUTH_EMAIL_TAKEN,
        message: 'Ya existe un recurso con esos datos',
        fields: null,
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Recurso no encontrado',
        fields: null,
      };
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.RESOURCE_CONFLICT,
        message: 'Referencia inválida (violación de clave foránea)',
        fields: null,
      };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Error interno del servidor',
        fields: null,
      };
  }
}

/** Extrae un mensaje plano de la respuesta de una HttpException. */
function extractMessage(exception: HttpException): string {
  const res = exception.getResponse();

  if (typeof res === 'string') {
    return res;
  }

  if (typeof res === 'object' && res !== null) {
    const body = res as Record<string, unknown>;
    const message = body.message;

    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.map((item) => String(item)).join(', ');
    }
  }

  return exception.message;
}

/**
 * Resuelve el `requestId` del header `X-Request-Id` (idempotente) o genera un
 * uuid si no viene. Nunca incorpora PII.
 */
function resolveRequestId(request: Request): string {
  const header = request.headers?.['x-request-id'];
  if (typeof header === 'string' && header.trim().length > 0) {
    return header;
  }
  return randomUUID();
}
