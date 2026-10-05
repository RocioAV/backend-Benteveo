import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, UseFilters } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { SESSION_COOKIE_NAME } from '../../common/constants/cookies';
import { AuthGuard } from '../../common/guards/auth.guard';
import { ChatService } from './chat.service';
import { CHAT_READY_STATE_OPEN, CHAT_WS_PATH } from './chat.constants';
import { ChatWsExceptionFilter, toChatError } from './chat.errors';
import { JoinChatDto } from './dto/join-chat.dto';
import { LeaveChatDto } from './dto/leave-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

interface ChatSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  user?: AuthenticatedUser;
  rooms?: Set<string>;
}

interface ChatUpgradeRequest extends IncomingMessage {
  chatUser?: AuthenticatedUser;
}

interface ChatVerifyClientInfo {
  origin: string;
  req: ChatUpgradeRequest;
}

type VerifyClientCallback = (
  verified: boolean,
  code?: number,
  name?: string,
  headers?: string[],
) => void;

interface ChatWsServer {
  options: {
    verifyClient?: (
      info: ChatVerifyClientInfo,
      callback: VerifyClientCallback,
    ) => void;
  };
}

type ChatServerEvent =
  | {
      type: 'message:history';
      reservationId: string;
      messages: unknown[];
    }
  | {
      type: 'message:new';
      message: unknown;
      clientMessageId?: string;
    };

function parseCookieHeader(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

@WebSocketGateway({ path: CHAT_WS_PATH })
@UseFilters(ChatWsExceptionFilter)
export class ChatGateway {
  private readonly rooms = new Map<string, Set<ChatSocket>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly authGuard: AuthGuard,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: ChatWsServer): void {
    server.options.verifyClient = (info, callback) => {
      this.verifyClient(info, callback);
    };
  }

  handleConnection(client: ChatSocket, request: ChatUpgradeRequest): void {
    if (!request.chatUser) {
      client.close(1008, 'Unauthorized');
      return;
    }

    client.user = request.chatUser;
    client.rooms = new Set<string>();
  }

  handleDisconnect(client: ChatSocket): void {
    for (const reservationId of client.rooms ?? []) {
      this.removeFromRoom(reservationId, client);
    }
    client.rooms?.clear();
  }

  @SubscribeMessage('join')
  async join(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: JoinChatDto,
  ): Promise<ChatServerEvent | ReturnType<typeof toChatError>> {
    try {
      const user = this.requireUser(client);
      const messages = await this.chatService.getHistory(
        payload.reservationId,
        user,
      );
      this.addToRoom(payload.reservationId, client);

      return {
        type: 'message:history',
        reservationId: payload.reservationId,
        messages,
      };
    } catch (error) {
      return toChatError(error);
    }
  }

  @SubscribeMessage('leave')
  leave(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: LeaveChatDto,
  ): void {
    this.removeFromRoom(payload.reservationId, client);
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: SendMessageDto,
  ): Promise<ReturnType<typeof toChatError> | undefined> {
    try {
      const user = this.requireUser(client);
      const message = await this.chatService.createMessage(
        payload.reservationId,
        user,
        payload.content,
      );

      await this.broadcast(payload.reservationId, {
        type: 'message:new',
        message,
        ...(payload.clientMessageId
          ? { clientMessageId: payload.clientMessageId }
          : {}),
      });
    } catch (error) {
      return toChatError(error, payload.clientMessageId);
    }

    return undefined;
  }

  private verifyClient(
    info: ChatVerifyClientInfo,
    callback: VerifyClientCallback,
  ): void {
    const origin = info.origin || info.req.headers.origin;
    if (typeof origin !== 'string' || !this.allowedOrigins().includes(origin)) {
      callback(false, 403, 'Origin not allowed');
      return;
    }

    const token = parseCookieHeader(
      info.req.headers.cookie,
      SESSION_COOKIE_NAME,
    );
    if (!token) {
      callback(false, 401, 'Unauthorized');
      return;
    }

    this.authGuard
      .authenticateSessionToken(token)
      .then((user) => {
        info.req.chatUser = user;
        callback(true);
      })
      .catch(() => callback(false, 401, 'Unauthorized'));
  }

  private allowedOrigins(): string[] {
    return (
      this.configService.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  private requireUser(client: ChatSocket): AuthenticatedUser {
    if (!client.user) {
      throw new UnauthorizedException('WebSocket session required');
    }
    return client.user;
  }

  private addToRoom(reservationId: string, client: ChatSocket): void {
    let room = this.rooms.get(reservationId);
    if (!room) {
      room = new Set<ChatSocket>();
      this.rooms.set(reservationId, room);
    }

    room.add(client);
    if (!client.rooms) client.rooms = new Set<string>();
    client.rooms.add(reservationId);
  }

  private removeFromRoom(reservationId: string, client: ChatSocket): void {
    const room = this.rooms.get(reservationId);
    room?.delete(client);
    if (room?.size === 0) this.rooms.delete(reservationId);
    client.rooms?.delete(reservationId);
  }

  private async broadcast(
    reservationId: string,
    event: Extract<ChatServerEvent, { type: 'message:new' }>,
  ): Promise<void> {
    const room = this.rooms.get(reservationId);
    if (!room) return;

    const clients = [...room];
    for (const client of clients) {
      if (!client.user) {
        this.removeFromRoom(reservationId, client);
        continue;
      }

      try {
        await this.chatService.assertParticipant(reservationId, client.user);
      } catch {
        this.removeFromRoom(reservationId, client);
        continue;
      }

      if (client.readyState === CHAT_READY_STATE_OPEN) {
        client.send(JSON.stringify(event));
      }
    }
  }
}
