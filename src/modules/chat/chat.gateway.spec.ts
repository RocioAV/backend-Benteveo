import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { Role } from '../../common/types/user.types';
import type { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

interface TestClient {
  readyState: number;
  send: jest.Mock<void, [string]>;
  close: jest.Mock<void, [number?, string?]>;
  user?: AuthenticatedUser;
  rooms?: Set<string>;
}

function createClient(): TestClient {
  return {
    readyState: 1,
    send: jest.fn<void, [string]>(),
    close: jest.fn<void, [number?, string?]>(),
  };
}

describe('ChatGateway', () => {
  const getHistory = jest.fn();
  const createMessage = jest.fn();
  const assertParticipant = jest.fn();
  const authenticateSessionToken = jest.fn();
  const chatService = {
    getHistory,
    createMessage,
    assertParticipant,
  } as unknown as ChatService;
  const authGuard = { authenticateSessionToken } as unknown as AuthGuard;
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:5173'),
  } as unknown as ConfigService;
  const gateway = new ChatGateway(chatService, authGuard, config);
  const user: AuthenticatedUser = {
    sub: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getHistory.mockResolvedValue([]);
    createMessage.mockResolvedValue({
      id: 'message-1',
      reservationId: 'reservation-1',
      senderId: 'user-1',
      content: 'hello',
      createdAt: new Date('2026-10-04T12:00:00.000Z'),
      readAt: null,
    });
    assertParticipant.mockResolvedValue({
      id: 'reservation-1',
      status: 'ACTIVE',
    });
    authenticateSessionToken.mockResolvedValue(user);
  });

  it('rejects disallowed origins before authenticating the session', () => {
    const server = { options: {} } as Parameters<ChatGateway['afterInit']>[0];
    gateway.afterInit(server);
    const callback = jest.fn();

    server.options.verifyClient?.(
      {
        origin: 'https://evil.example',
        req: { headers: {} } as never,
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(false, 403, 'Origin not allowed');
    expect(authenticateSessionToken).not.toHaveBeenCalled();
  });

  it('authenticates the handshake from the session cookie and stores the user', async () => {
    const server = { options: {} } as Parameters<ChatGateway['afterInit']>[0];
    gateway.afterInit(server);
    const callback = jest.fn();
    const request = {
      headers: {
        cookie: 'other=value; benteveo_session=session.jwt',
      },
    };

    server.options.verifyClient?.(
      {
        origin: 'http://localhost:5173',
        req: request as never,
      },
      callback,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(authenticateSessionToken).toHaveBeenCalledWith('session.jwt');
    expect(callback).toHaveBeenCalledWith(true);
    expect((request as { chatUser?: AuthenticatedUser }).chatUser).toEqual(
      user,
    );
  });

  it('persists before broadcasting and propagates clientMessageId', async () => {
    const client = createClient();
    client.user = user;
    const server = { options: {} } as Parameters<ChatGateway['afterInit']>[0];
    gateway.afterInit(server);
    await gateway.join(client, { reservationId: 'reservation-1' });
    await gateway.sendMessage(client, {
      reservationId: 'reservation-1',
      content: 'hello',
      clientMessageId: 'client-1',
    });

    expect(createMessage).toHaveBeenCalledWith('reservation-1', user, 'hello');
    expect(assertParticipant).toHaveBeenCalledWith('reservation-1', user);
    const event = JSON.parse(client.send.mock.calls[0][0]) as Record<
      string,
      unknown
    >;
    expect(event).toMatchObject({
      type: 'message:new',
      message: { id: 'message-1' },
      clientMessageId: 'client-1',
    });
  });

  it('does not broadcast when persistence fails', async () => {
    const client = createClient();
    client.user = user;
    await gateway.join(client, { reservationId: 'reservation-1' });
    createMessage.mockRejectedValue(new Error('database unavailable'));

    const result = await gateway.sendMessage(client, {
      reservationId: 'reservation-1',
      content: 'hello',
      clientMessageId: 'client-2',
    });

    expect(result).toEqual({
      type: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      clientMessageId: 'client-2',
    });
    expect(client.send).not.toHaveBeenCalled();
  });
});
