import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  function createHost(url: string) {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  it('normaliza un HttpException al shape esperado', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(new BadRequestException('Mensaje de error'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Mensaje de error',
        error: 'Bad Request',
        path: '/api/v1/test',
        timestamp: expect.any(String),
      }),
    );
  });

  it('normaliza un error genérico como 500', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'Internal Server Error',
        path: '/api/v1/test',
      }),
    );
  });
});
