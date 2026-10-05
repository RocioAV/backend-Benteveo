import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/constants/error-codes';
import { SESSION_COOKIE_NAME } from '../../common/constants/cookies';
import { PrismaService } from '../../prisma/prisma.service';
import type { ChatRequestDto } from './dto/chat.dto';

export interface AiUserContext {
  name: string;
  isIdentityVerified: boolean;
  reservations: number;
  products: number;
  favorites: number;
}

const SYSTEM_PROMPT = `Sos Benti, el asistente virtual oficial de Benteveo. Tu única función es ayudar con la aplicación Benteveo: respondés siempre en español rioplatense, con tono amigable y breve (2 a 4 oraciones, salvo que te pidan un paso a paso).

SOBRE BENTEVEO
- Plataforma P2P hiperlocal de alquiler de objetos entre vecinos de Argentina.
- Misión: reducir el consumo y fortalecer la comunidad del barrio.
- No sos un asistente general: solo respondés sobre Benteveo. Si te preguntan de otro tema, respondés amablemente que solo ayudás con Benteveo.

CÓMO SE USA LA APLICACIÓN (rutas reales)
- Inicio (/): destacados y secciones de la landing.
- Explorar (/explorar): catálogo con buscador y filtros de productos.
- Ficha de producto (/detalle/:id): galería, precio por día, depósito, datos del dueño (con pin de identidad verificada), calendario para reservar, botón de favorito (corazón) y sección de reseñas con calificaciones y comentarios.
- Publicar (/publicar): formulario en 3 pasos (detalles, precio y confirmación) con fotos; requiere identidad verificada.
- Reserva (/reservation/:id): calendario, fechas, desglose de precio, depósito y comisión; se paga con MercadoPago.
- Estados de pago: /pago-exitoso, /pago-pendiente y /pago-fallido.
- Mis reservas (/reservas): reservas como inquilino y como dueño.
- Dashboard (/dashboard): Mi perfil (editar nombre, teléfono, bio y foto; estado de verificación), Mis reservas, Agenda (entregas y devoluciones a las 12:00), Mis publicaciones (activar/desactivar/borrar), Favoritos (productos guardados con el corazón) y Conversaciones.
- Chat (/chat/:reservationId): conversación interna entre dueño e inquilino de cada reserva.
- Admin (/admin): panel solo para administradores.
- Cuenta: /login, /register y /forgot-password.
- Cualquier otra URL muestra una página 404 con buscador y accesos rápidos.

REGLAS DE NEGOCIO
- Precios: cada dueño define precio por día y por mes. La plataforma cobra una comisión del 10% sobre el total de la operación.
- Depósito en garantía: se retiene al reservar y se libera al devolver el objeto en buen estado.
- Pagos: solo MercadoPago (tarjeta de crédito, débito o en cuotas). Nunca se ingresa tarjeta dentro de la web de Benteveo; si un pago falla se reintenta desde la pantalla de pago.
- Cancelación: gratis si faltan más de 48 horas para la entrega; con cargo si faltan 48 horas o menos.
- Identidad: para reservar y publicar es obligatorio verificar la identidad (DNI y selfie) y esperar la aprobación del administrador. El pin "verificado" se ve en el perfil y en la ficha del dueño.
- Entrega y devolución: se coordinan con el dueño (a domicilio o en mano), se registran a las 12:00 del día pactado en Agenda, y siguen el ciclo Pendiente → Confirmada → En curso → Completada (o Cancelada).
- Calificaciones: en la ficha de cada producto cualquiera con sesión puede puntuar de 1 a 5 estrellas; el promedio y la cantidad de reseñas se recalculan automáticamente. El dueño no puede calificar su propio producto.
- Comentarios: se publican en la ficha del producto en una lista aparte de las calificaciones; su autor (o un administrador) puede eliminarlos.
- Favoritos: el corazón de cada tarjeta y de la ficha guarda el producto en "Mis favoritos" del dashboard; requiere iniciar sesión.
- Alquiler mínimo y políticas: están indicados en cada ficha, dentro de "Condiciones de alquiler".
- Reputación: alquilá mucho y calificá bien; se muestra en la ficha de cada producto.

CUENTA Y PERFIL
- Registro: nombre, email, DNI y contraseña (mínimo 8 caracteres con mayúscula, minúscula, número y símbolo).
- Recuperar contraseña: desde /forgot-password llega un email.
- El perfil se edita en Dashboard → Mi perfil (nombre, teléfono, bio y foto).

SOPORTE
- Email: soporte@benteveo.com (respuesta en menos de 24 horas).
- WhatsApp: +54 11 1234-5678 (lunes a viernes de 9 a 18 horas).

LÍMITES
- Nunca inventés precios, estados, funciones ni datos de contacto que no estén en este conocimiento.
- No des opiniones personales ni recomendaciones ajenas a Benteveo.`;

const RETRY_DELAY_MS = 1200;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async generate(
    dto: ChatRequestDto,
    user: AiUserContext | null,
  ): Promise<{ text: string }> {
    const response = await this.requestGemini(
      `${this.modelUrl()}:generateContent`,
      this.buildPayload(dto, user),
    );

    const data = (await response.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    } | null;

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('');

    if (!text) {
      throw this.unavailable();
    }

    return { text };
  }

  async openStream(
    dto: ChatRequestDto,
    user: AiUserContext | null,
  ): Promise<Response> {
    return this.requestGemini(
      `${this.modelUrl()}:streamGenerateContent?alt=sse`,
      this.buildPayload(dto, user),
    );
  }

  async resolveRequestUser(req: Request): Promise<AiUserContext | null> {
    try {
      const cookies = (req as unknown as { cookies?: Record<string, string> })
        .cookies;
      const token = cookies?.[SESSION_COOKIE_NAME];
      if (!token) {
        return null;
      }

      const payload: unknown = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      const sub = (payload as { sub?: unknown } | null)?.sub;
      if (typeof sub !== 'string') {
        return null;
      }

      const user = await this.prisma.user.findFirst({
        where: { id: sub, isDeleted: false },
        select: { name: true, isIdentityVerified: true },
      });
      if (!user) {
        return null;
      }

      const [reservations, products, favorites] = await Promise.all([
        this.prisma.reservation.count({ where: { userId: sub } }),
        this.prisma.product.count({ where: { ownerId: sub } }),
        this.prisma.favorite.count({ where: { userId: sub } }),
      ]);

      return {
        name: user.name,
        isIdentityVerified: user.isIdentityVerified,
        reservations,
        products,
        favorites,
      };
    } catch {
      return null;
    }
  }

  private buildPayload(dto: ChatRequestDto, user: AiUserContext | null) {
    const contents = (dto.history ?? []).map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: dto.message }] });

    return {
      contents,
      systemInstruction: {
        parts: [{ text: this.buildSystemInstruction(dto, user) }],
      },
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.4,
      },
    };
  }

  private buildSystemInstruction(
    dto: ChatRequestDto,
    user: AiUserContext | null,
  ): string {
    let prompt = SYSTEM_PROMPT;

    if (user) {
      prompt += `

DATOS DE LA CUENTA DEL USUARIO (sesión iniciada)
- Nombre: ${user.name}
- Identidad verificada: ${user.isIdentityVerified ? 'sí' : 'no'}
- Reservas como inquilino: ${user.reservations}
- Publicaciones: ${user.products}
- Favoritos guardados: ${user.favorites}
Usá estos datos para responder consultas personales del usuario (p. ej. "¿cuántos favoritos tengo?"). Si pregunta por el detalle de una reserva, un pago o un mensaje, indicale que lo mire en su Dashboard, Mis reservas o Conversaciones; no inventes datos que no están acá.`;
    }

    const lines: string[] = [];
    if (dto.context?.page) {
      lines.push(`- Página donde está el usuario ahora: ${dto.context.page}`);
    }
    if (dto.context?.product?.title) {
      const price =
        dto.context.product.pricePerDay !== undefined
          ? `, $${dto.context.product.pricePerDay} por día`
          : '';
      lines.push(
        `- Producto que está viendo: "${dto.context.product.title}"${price}`,
      );
    }
    if (lines.length > 0) {
      prompt += `\n\nCONTEXTO ACTUAL DEL USUARIO\n${lines.join('\n')}`;
    }

    return prompt;
  }

  private async requestGemini(
    url: string,
    payload: unknown,
  ): Promise<Response> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY no está configurada');
      throw this.unavailable();
    }

    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    };

    try {
      let response = await fetch(url, init);

      if (response.status === 429 || response.status === 503) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        response = await fetch(url, init);
      }

      if (!response.ok) {
        this.logger.error(
          `Gemini respondió ${response.status}: ${await response.text().catch(() => '')}`,
        );
        throw this.unavailable();
      }

      return response;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      this.logger.error(
        `Error llamando a Gemini: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw this.unavailable();
    }
  }

  private modelUrl(): string {
    const base = (
      this.config.get<string>('GEMINI_API_URL') ??
      'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/+$/, '');
    const model =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
    return `${base}/models/${model}`;
  }

  private unavailable(): AppException {
    return new AppException(
      ErrorCode.AI_UNAVAILABLE,
      'El asistente no está disponible en este momento. Probá de nuevo en unos segundos.',
      HttpStatus.BAD_GATEWAY,
    );
  }
}
