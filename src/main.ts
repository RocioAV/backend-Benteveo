import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

type ChatWsData = string | Buffer | ArrayBuffer | Buffer[];

interface ParsedChatMessage {
  event: string;
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Native clients use the public `{ type, ...payload }` contract. Nest's ws
 * adapter expects `{ event, data }`, so translate only at the transport edge.
 */
export function parseChatMessage(data: ChatWsData): ParsedChatMessage | void {
  let raw: string;

  if (typeof data === 'string') {
    raw = data;
  } else if (Buffer.isBuffer(data)) {
    raw = data.toString('utf8');
  } else if (data instanceof ArrayBuffer) {
    raw = Buffer.from(data).toString('utf8');
  } else {
    raw = Buffer.concat(data).toString('utf8');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed)) {
    return undefined;
  }

  const event = parsed.type ?? parsed.event;
  if (typeof event !== 'string' || event.length === 0) {
    return undefined;
  }

  if ('data' in parsed) {
    return { event, data: parsed.data };
  }

  const payload = { ...parsed };
  delete payload.type;
  delete payload.event;
  return { event, data: payload };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  app.useWebSocketAdapter(
    new WsAdapter(app, { messageParser: parseChatMessage }),
  );

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Parsea cookies entrantes (`req.cookies`) para la sesión HttpOnly + CSRF.
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
