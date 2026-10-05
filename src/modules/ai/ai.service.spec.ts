import { AiService, type AiUserContext } from './ai.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import type { ChatRequestDto } from './dto/chat.dto';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../prisma/prisma.service';

const USER_CONTEXT: AiUserContext = {
  name: 'Ana',
  isIdentityVerified: true,
  reservations: 2,
  products: 1,
  favorites: 3,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeDto(overrides: Partial<ChatRequestDto> = {}): ChatRequestDto {
  return { message: 'Hola', ...overrides };
}

describe('AiService', () => {
  let service: AiService;
  let fetchMock: jest.Mock;
  let prisma: {
    user: { findFirst: jest.Mock };
    reservation: { count: jest.Mock };
    product: { count: jest.Mock };
    favorite: { count: jest.Mock };
  };
  let jwt: { verifyAsync: jest.Mock };
  let configValues: Record<string, string | undefined>;

  beforeEach(() => {
    configValues = {
      GEMINI_API_KEY: 'test-key',
      JWT_SECRET: 'secret',
    };
    const config = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;

    jwt = { verifyAsync: jest.fn() };
    prisma = {
      user: { findFirst: jest.fn() },
      reservation: { count: jest.fn() },
      product: { count: jest.fn() },
      favorite: { count: jest.fn() },
    };

    service = new AiService(
      config,
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
    );

    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generate', () => {
    it('devuelve el texto de la respuesta', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: '¡Hola!' }] } }],
        }),
      );

      await expect(service.generate(makeDto(), null)).resolves.toEqual({
        text: '¡Hola!',
      });
    });

    it('reintenta una vez ante 503 y resuelve', async () => {
      fetchMock
        .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
        .mockResolvedValueOnce(
          jsonResponse({
            candidates: [{ content: { parts: [{ text: 'OK' }] } }],
          }),
        );

      await expect(service.generate(makeDto(), null)).resolves.toEqual({
        text: 'OK',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('lanza AI_UNAVAILABLE ante un error permanente', async () => {
      fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));

      const promise = service.generate(makeDto(), null);
      await expect(promise).rejects.toBeInstanceOf(AppException);
      await expect(promise).rejects.toMatchObject({
        code: ErrorCode.AI_UNAVAILABLE,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('lanza AI_UNAVAILABLE sin API key configurada', async () => {
      configValues.GEMINI_API_KEY = undefined;

      await expect(service.generate(makeDto(), null)).rejects.toMatchObject({
        code: ErrorCode.AI_UNAVAILABLE,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('lanza AI_UNAVAILABLE cuando la respuesta no trae texto', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ candidates: [] }));

      await expect(service.generate(makeDto(), null)).rejects.toMatchObject({
        code: ErrorCode.AI_UNAVAILABLE,
      });
    });

    it('arma el payload con historial, contexto de página/producto y datos del usuario', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        }),
      );

      const dto = makeDto({
        history: [
          { role: 'user', text: 'pregunta previa' },
          { role: 'model', text: 'respuesta previa' },
        ],
        context: {
          page: 'Ficha de un producto',
          product: { title: 'Taladro', pricePerDay: 1500 },
        },
      });

      await service.generate(dto, USER_CONTEXT);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string) as {
        contents: { role: string; parts: { text: string }[] }[];
        systemInstruction: { parts: { text: string }[] };
      };

      expect(payload.contents).toEqual([
        { role: 'user', parts: [{ text: 'pregunta previa' }] },
        { role: 'model', parts: [{ text: 'respuesta previa' }] },
        { role: 'user', parts: [{ text: 'Hola' }] },
      ]);

      const system = payload.systemInstruction.parts[0].text;
      expect(system).toContain('Sos Benti');
      expect(system).toContain(
        'Página donde está el usuario ahora: Ficha de un producto',
      );
      expect(system).toContain(
        'Producto que está viendo: "Taladro", $1500 por día',
      );
      expect(system).toContain('Nombre: Ana');
      expect(system).toContain('Reservas como inquilino: 2');
      expect(system).toContain('Favoritos guardados: 3');
    });

    it('no incluye bloque de usuario cuando es invitado', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        }),
      );

      await service.generate(makeDto({ context: { page: 'Inicio' } }), null);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const payload = JSON.parse(init.body as string) as {
        systemInstruction: { parts: { text: string }[] };
      };
      const system = payload.systemInstruction.parts[0].text;

      expect(system).not.toContain('DATOS DE LA CUENTA DEL USUARIO');
      expect(system).toContain('Página donde está el usuario ahora: Inicio');
    });
  });

  describe('openStream', () => {
    it('usa streamGenerateContent con alt=sse y envía la key por header', async () => {
      const upstream = jsonResponse({});
      fetchMock.mockResolvedValueOnce(upstream);

      await expect(service.openStream(makeDto(), null)).resolves.toBe(upstream);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain(':streamGenerateContent?alt=sse');
      const headers = init.headers as Record<string, string>;
      expect(headers['x-goog-api-key']).toBe('test-key');
    });
  });

  describe('resolveRequestUser', () => {
    const req = (cookie?: string) =>
      ({ cookies: cookie ? { benteveo_session: cookie } : {} }) as never;

    it('devuelve null sin cookie de sesión', async () => {
      await expect(service.resolveRequestUser(req())).resolves.toBeNull();
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
    });

    it('devuelve null cuando el token es inválido', async () => {
      jwt.verifyAsync.mockRejectedValueOnce(new Error('invalid'));

      await expect(service.resolveRequestUser(req('tok'))).resolves.toBeNull();
    });

    it('devuelve null cuando el usuario no existe', async () => {
      jwt.verifyAsync.mockResolvedValueOnce({ sub: 'u1' });
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(service.resolveRequestUser(req('tok'))).resolves.toBeNull();
    });

    it('devuelve la contexto con conteos cuando la sesión es válida', async () => {
      jwt.verifyAsync.mockResolvedValueOnce({ sub: 'u1' });
      prisma.user.findFirst.mockResolvedValueOnce({
        name: 'Ana',
        isIdentityVerified: true,
      });
      prisma.reservation.count.mockResolvedValueOnce(2);
      prisma.product.count.mockResolvedValueOnce(1);
      prisma.favorite.count.mockResolvedValueOnce(3);

      await expect(service.resolveRequestUser(req('tok'))).resolves.toEqual(
        USER_CONTEXT,
      );
      expect(prisma.reservation.count).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });
  });
});
