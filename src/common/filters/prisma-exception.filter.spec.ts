import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

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

  function prismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('prisma error', {
      code,
      clientVersion: Prisma.prismaVersion.client,
    });
  }

  it('mapea P2002 a 409 Conflict', () => {
    const { host, status, json } = createHost('/api/v1/test');

    filter.catch(prismaError('P2002'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'P2002' }),
    );
  });

  it('mapea P2025 a 404 NotFound', () => {
    const { host, status } = createHost('/api/v1/test');

    filter.catch(prismaError('P2025'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('mapea P2003 a 400 BadRequest', () => {
    const { host, status } = createHost('/api/v1/test');

    filter.catch(prismaError('P2003'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('mapea un código desconocido a 500', () => {
    const { host, status } = createHost('/api/v1/test');

    filter.catch(prismaError('P9999'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
