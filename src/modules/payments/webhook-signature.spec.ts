import { createHmac } from 'crypto';
import { isValidWebhookSignature } from './webhook-signature';

const SECRET = 'fb9026fe7c64a1d2b3c4';
const DATA_ID = '123456789';
const REQUEST_ID = 'req-1';
const TS = '1748901234';

function sign(manifest: string, digest: 'hex' | 'base64'): string {
  return createHmac('sha256', SECRET).update(manifest).digest(digest);
}

describe('isValidWebhookSignature', () => {
  it('acepta una firma hex válida (manifest id:)', () => {
    const v1 = sign(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`, 'hex');
    expect(
      isValidWebhookSignature(
        {
          signatureHeader: `ts=${TS},v1=${v1}`,
          requestId: REQUEST_ID,
          dataId: DATA_ID,
        },
        SECRET,
      ),
    ).toBe(true);
  });

  it('acepta una firma en base64', () => {
    const v1 = sign(
      `id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`,
      'base64',
    );
    expect(
      isValidWebhookSignature(
        {
          signatureHeader: `ts=${TS},v1=${v1}`,
          requestId: REQUEST_ID,
          dataId: DATA_ID,
        },
        SECRET,
      ),
    ).toBe(true);
  });

  it('acepta el manifest alternativo data.id:', () => {
    const v1 = sign(
      `data.id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`,
      'hex',
    );
    expect(
      isValidWebhookSignature(
        {
          signatureHeader: `ts=${TS},v1=${v1}`,
          requestId: REQUEST_ID,
          dataId: DATA_ID,
        },
        SECRET,
      ),
    ).toBe(true);
  });

  it('rechaza una firma firmada con otro secreto', () => {
    const v1 = createHmac('sha256', 'otro-secreto')
      .update(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`)
      .digest('hex');
    expect(
      isValidWebhookSignature(
        {
          signatureHeader: `ts=${TS},v1=${v1}`,
          requestId: REQUEST_ID,
          dataId: DATA_ID,
        },
        SECRET,
      ),
    ).toBe(false);
  });

  it('rechaza un ts manipulado', () => {
    const v1 = sign(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`, 'hex');
    expect(
      isValidWebhookSignature(
        {
          signatureHeader: `ts=9999999999,v1=${v1}`,
          requestId: REQUEST_ID,
          dataId: DATA_ID,
        },
        SECRET,
      ),
    ).toBe(false);
  });

  it('rechaza headers ausentes o incompletos', () => {
    expect(isValidWebhookSignature({ dataId: DATA_ID }, SECRET)).toBe(false);
    expect(
      isValidWebhookSignature(
        { signatureHeader: `ts=${TS}`, dataId: DATA_ID },
        SECRET,
      ),
    ).toBe(false);
    expect(
      isValidWebhookSignature({ signatureHeader: `ts=${TS},v1=abc` }, SECRET),
    ).toBe(false);
  });
});
