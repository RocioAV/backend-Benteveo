import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../constants/error-codes';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createHost(
    url: string,
    headers: Record<string, string> = {},
  ) {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url, headers }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  function prismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('prisma error', {
      code,
      clientVersion: Prisma.prismaVersion.client,
      meta: { target: ['email'] },
    });
  }

  it('emite el shape estable {code,message,fields,requestId} para un AppException', () => {
    const { host, status, json } = createHost('/api/v1/test', {
      'x-request-id': 'req-123',
    });

    filter.catch(
      new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'No encontrado',
        HttpStatus.NOT_FOUND,
      ),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = json.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(
      ['code', 'message', 'fields', 'requestId'].sort(),
    );
    expect(body).toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: 'No encontrado',
      fields: null,
      requestId: 'req-123',
    });
  });

  it('mapea una HttpException genérica a un code derivado del status', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(new UnauthorizedException('Token inválido'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'Token inválido',
      }),
    );
  });

  it('mapea Prisma P2002 a 409 AUTH_EMAIL_TAKEN', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(prismaError('P2002'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.AUTH_EMAIL_TAKEN,
        fields: null,
      }),
    );
  });

  it('mapea Prisma P2025 a 404 RESOURCE_NOT_FOUND', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(prismaError('P2025'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCode.RESOURCE_NOT_FOUND }),
    );
  });

  it('mapea Prisma P2003 a 409 RESOURCE_CONFLICT', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(prismaError('P2003'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCode.RESOURCE_CONFLICT }),
    );
  });

  it('normaliza un error Prisma desconocido a 500 INTERNAL_ERROR sin detalles', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(prismaError('P9999'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.message).toBe('Error interno del servidor');
    expect(JSON.stringify(body)).not.toContain('P9999');
    expect(body.stack).toBeUndefined();
    expect(body.query).toBeUndefined();
    expect(body.meta).toBeUndefined();
  });

  it('normaliza un Error genérico a 500 INTERNAL_ERROR sin stack', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(new Error('boom secreto'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(JSON.stringify(body)).not.toContain('boom secreto');
    expect(body.stack).toBeUndefined();
  });

  it('refleja el X-Request-Id entrante como requestId', () => {
    const { host, json } = createHost('/api/v1/test', {
      'x-request-id': 'trace-999',
    });

    filter.catch(new BadRequestException('x'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'trace-999' }),
    );
  });

  it('genera un requestId si no viene header', () => {
    const { host, json } = createHost('/api/v1/test');

    filter.catch(new BadRequestException('x'), host);

    const body = json.mock.calls[0][0];
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
