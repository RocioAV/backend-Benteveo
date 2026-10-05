import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../../common/guards/auth.guard';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { Role } from '../../common/types/user.types';
import type { ChatService } from './chat.service';
import type { InquiriesService } from '../inquiries/inquiries.service';
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
  const getInquiryHistory = jest.fn();
  const createInquiryMessage = jest.fn();
  const assertInquiryParticipant = jest.fn();
  const authenticateSessionToken = jest.fn();
  const chatService = {
    getHistory,
    createMessage,
    assertParticipant,
  } as unknown as ChatService;
  const inquiriesService = {
    getHistory: getInquiryHistory,
    createMessage: createInquiryMessage,
    assertParticipant: assertInquiryParticipant,
  } as unknown as InquiriesService;
  const authGuard = { authenticateSessionToken } as unknown as AuthGuard;
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:5173'),
  } as unknown as ConfigService;
  const gateway = new ChatGateway(
    chatService,
    inquiriesService,
    authGuard,
    config,
  );
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
    getInquiryHistory.mockResolvedValue([]);
    createInquiryMessage.mockResolvedValue({
      id: 'inquiry-message-1',
      inquiryId: 'inquiry-1',
      senderId: 'user-1',
      content: 'hello',
      createdAt: new Date('2026-10-04T12:00:00.000Z'),
      readAt: null,
    });
    assertInquiryParticipant.mockResolvedValue({ id: 'inquiry-1' });
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

  it('returns namespaced inquiry history and broadcasts persisted messages', async () => {
    const client = createClient();
    client.user = user;
    const order: string[] = [];
    getInquiryHistory.mockResolvedValue([
      { id: 'old-message', inquiryId: 'inquiry-1' },
    ]);
    createInquiryMessage.mockImplementation(async () => {
      order.push('persist');
      return {
        id: 'inquiry-message-1',
        inquiryId: 'inquiry-1',
        senderId: 'user-1',
        content: 'hello',
      };
    });
    assertInquiryParticipant.mockImplementation(async () => {
      order.push('authorize-broadcast');
      return { id: 'inquiry-1' };
    });

    await expect(
      gateway.joinInquiry(client, { inquiryId: 'inquiry-1' }),
    ).resolves.toEqual({
      type: 'inquiry:history',
      inquiryId: 'inquiry-1',
      messages: [{ id: 'old-message', inquiryId: 'inquiry-1' }],
    });
    await gateway.sendInquiryMessage(client, {
      inquiryId: 'inquiry-1',
      content: 'hello',
      clientMessageId: 'inquiry-client-1',
    });

    expect(createInquiryMessage).toHaveBeenCalledWith(
      'inquiry-1',
      user,
      'hello',
    );
    expect(order).toEqual(['persist', 'authorize-broadcast']);
    expect(JSON.parse(client.send.mock.calls[0][0])).toEqual({
      type: 'inquiry:message:new',
      message: {
        id: 'inquiry-message-1',
        inquiryId: 'inquiry-1',
        senderId: 'user-1',
        content: 'hello',
      },
      clientMessageId: 'inquiry-client-1',
    });
  });

  it('keeps reservation and inquiry rooms separate when identifiers match', async () => {
    const reservationClient = createClient();
    reservationClient.user = user;
    const inquiryClient = createClient();
    inquiryClient.user = user;

    await gateway.join(reservationClient, { reservationId: 'same-id' });
    await gateway.joinInquiry(inquiryClient, { inquiryId: 'same-id' });
    await gateway.sendMessage(reservationClient, {
      reservationId: 'same-id',
      content: 'reservation',
    });
    await gateway.sendInquiryMessage(inquiryClient, {
      inquiryId: 'same-id',
      content: 'inquiry',
    });

    expect(
      JSON.parse(reservationClient.send.mock.calls[0][0]).type,
    ).toBe('message:new');
    expect(reservationClient.send).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(inquiryClient.send.mock.calls[0][0]).type,
    ).toBe('inquiry:message:new');
    expect(inquiryClient.send).toHaveBeenCalledTimes(1);
  });
});
