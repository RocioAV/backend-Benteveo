import type { Request, Response } from 'express';
import { AiController } from './ai.controller';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import type { AiService } from './ai.service';
import type { AiRateLimiter } from './ai-rate.limiter';
import type { ChatRequestDto } from './dto/chat.dto';

function fakeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
}

function fakeRequest(): Request {
  return { ip: '1.2.3.4', cookies: {} } as unknown as Request;
}

function upstreamWithChunks(chunks: Uint8Array[]) {
  const reader = {
    read: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
  };
  for (const chunk of chunks) {
    reader.read.mockResolvedValueOnce({ done: false, value: chunk });
  }
  reader.read.mockResolvedValueOnce({ done: true, value: undefined });
  return { body: { getReader: () => reader }, reader };
}

describe('AiController', () => {
  let controller: AiController;
  let aiService: {
    resolveRequestUser: jest.Mock;
    generate: jest.Mock;
    openStream: jest.Mock;
  };
  let limiter: { consume: jest.Mock };

  beforeEach(() => {
    aiService = {
      resolveRequestUser: jest.fn().mockResolvedValue(null),
      generate: jest.fn().mockResolvedValue({ text: 'hola' }),
      openStream: jest.fn(),
    };
    limiter = { consume: jest.fn() };
    controller = new AiController(
      aiService as unknown as AiService,
      limiter as unknown as AiRateLimiter,
    );
  });

  const dto: ChatRequestDto = { message: 'hola' };

  it('chat: limita por IP, resuelve el usuario y devuelve el texto', async () => {
    await expect(controller.chat(dto, fakeRequest())).resolves.toEqual({
      text: 'hola',
    });
    expect(limiter.consume).toHaveBeenCalledWith('1.2.3.4');
    expect(aiService.resolveRequestUser).toHaveBeenCalled();
    expect(aiService.generate).toHaveBeenCalledWith(dto, null);
  });

  it('stream: configura headers SSE y envía los chunks al cliente', async () => {
    const res = fakeRes();
    const chunks = [
      new TextEncoder().encode('data: {"a":1}\n\n'),
      new TextEncoder().encode('data: {"b":2}\n\n'),
    ];
    const { reader } = upstreamWithChunks(chunks);
    aiService.openStream.mockResolvedValueOnce({
      body: { getReader: () => reader },
    });

    await controller.stream(dto, fakeRequest(), res as unknown as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream',
    );
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledTimes(2);
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('stream: si openStream falla, no escribe headers SSE y propaga el error', async () => {
    const res = fakeRes();
    aiService.openStream.mockRejectedValueOnce(
      new AppException(ErrorCode.AI_UNAVAILABLE, 'no disponible', 502),
    );

    await expect(
      controller.stream(dto, fakeRequest(), res as unknown as Response),
    ).rejects.toBeInstanceOf(AppException);
    expect(res.flushHeaders).not.toHaveBeenCalled();
    expect(res.write).not.toHaveBeenCalled();
  });

  it('stream: si el upstream no trae body, cierra la respuesta', async () => {
    const res = fakeRes();
    aiService.openStream.mockResolvedValueOnce({ body: null });

    await controller.stream(dto, fakeRequest(), res as unknown as Response);

    expect(res.write).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
