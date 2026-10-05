import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  WsExceptionFilter,
} from '@nestjs/common';
import { ErrorCode } from '../../common/constants/error-codes';
import { AppException } from '../../common/exceptions/app.exception';

export interface ChatErrorEvent {
  type: 'error';
  code: ErrorCode;
  message: string;
  clientMessageId?: string;
}

interface ChatClientLike {
  send(data: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function codeForStatus(status: number): ErrorCode {
  if (status === Number(HttpStatus.UNAUTHORIZED)) {
    return ErrorCode.AUTH_UNAUTHORIZED;
  }
  if (status === Number(HttpStatus.FORBIDDEN)) return ErrorCode.AUTH_FORBIDDEN;
  if (status === Number(HttpStatus.NOT_FOUND)) {
    return ErrorCode.RESOURCE_NOT_FOUND;
  }
  if (status === Number(HttpStatus.CONFLICT)) {
    return ErrorCode.RESOURCE_CONFLICT;
  }
  if (
    status === Number(HttpStatus.BAD_REQUEST) ||
    status === Number(HttpStatus.UNPROCESSABLE_ENTITY)
  ) {
    return ErrorCode.VALIDATION_FAILED;
  }
  return ErrorCode.INTERNAL_ERROR;
}

function messageForException(exception: unknown): string {
  if (exception instanceof AppException) {
    return exception.message;
  }

  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (isRecord(response) && typeof response.message === 'string') {
      return response.message;
    }
    return exception.message;
  }

  return 'Error interno del servidor';
}

export function toChatError(
  exception: unknown,
  clientMessageId?: string,
): ChatErrorEvent {
  const status =
    exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  const event: ChatErrorEvent = {
    type: 'error',
    code:
      exception instanceof AppException
        ? exception.code
        : codeForStatus(status),
    message: messageForException(exception),
  };

  if (clientMessageId) {
    event.clientMessageId = clientMessageId;
  }

  return event;
}

@Catch()
export class ChatWsExceptionFilter implements WsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<ChatClientLike>();
    const data: unknown = host.switchToWs().getData();
    const clientMessageId =
      isRecord(data) && typeof data.clientMessageId === 'string'
        ? data.clientMessageId
        : undefined;

    client.send(JSON.stringify(toChatError(exception, clientMessageId)));
  }
}
