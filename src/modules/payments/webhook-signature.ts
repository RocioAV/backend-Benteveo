import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookSignatureInput {
  signatureHeader?: string;
  requestId?: string;
  dataId?: string;
}

function parseSignatureHeader(header: string): { ts?: string; v1?: string } {
  const result: { ts?: string; v1?: string } = {};
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    result[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return result;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Valida la firma `x-signature` que Mercado Pago envía en los webhooks
 * (HMAC-SHA256 del manifest `id:...;request-id:...;ts:...;` con el secreto
 * configurado en el panel de MP). Acepta digest en hex o base64 y tanto el
 * manifest de webhooks (`id:`) como el de IPN (`data.id:`), porque MP cambia
 * el formato según el tipo de notificación.
 */
export function isValidWebhookSignature(
  input: WebhookSignatureInput,
  secret: string,
): boolean {
  const { signatureHeader, requestId = '', dataId } = input;
  if (!signatureHeader) return false;

  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1 || !dataId) return false;

  const manifests = [
    `id:${dataId};request-id:${requestId};ts:${ts};`,
    `data.id:${dataId};request-id:${requestId};ts:${ts};`,
  ];

  for (const manifest of manifests) {
    const hmac = createHmac('sha256', secret);
    hmac.update(manifest);
    if (safeEqual(hmac.digest('hex'), v1)) return true;
    const hmacB64 = createHmac('sha256', secret);
    hmacB64.update(manifest);
    if (safeEqual(hmacB64.digest('base64'), v1)) return true;
  }

  return false;
}
