import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
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
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalized = normalizeException(exception);
    const requestId = resolveRequestId(request);

    if (normalized.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${normalized.status} ${normalized.code}`,
        exception instanceof Error ? exception.stack : undefined,
        { requestId },
      );
    } else if (normalized.status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} ${normalized.status} ${normalized.code} ${normalized.message}`,
        { requestId },
      );
    }

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

  if (isMulterLimitError(exception)) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCode.VALIDATION_FAILED,
      message:
        exception.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera el tamaño máximo permitido'
          : 'Archivo inválido',
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

function isMulterLimitError(
  exception: unknown,
): exception is Error & { code: string } {
  return (
    exception instanceof Error &&
    'code' in exception &&
    typeof (exception as { code?: unknown }).code === 'string' &&
    (exception as { code: string }).code.startsWith('LIMIT_')
  );
}

const STATUS_CODE_MAP: Readonly<Record<number, ErrorCode>> = {
  [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTH_UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.AUTH_FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.RESOURCE_NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.RESOURCE_CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
};

/** Deriva un `code` estable a partir del status HTTP de una HttpException genérica. */
function mapStatusToCode(status: number): ErrorCode {
  return STATUS_CODE_MAP[status] ?? ErrorCode.INTERNAL_ERROR;
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
