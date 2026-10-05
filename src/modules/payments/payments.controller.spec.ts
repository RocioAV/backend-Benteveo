import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MercadoPagoService } from './mercadopago.service';
import { createHmac } from 'crypto';

describe('PaymentsController', () => {
  const mockFindOne = jest.fn();
  const mockCreatePreference = jest.fn();
  const mockHandleWebhook = jest.fn();

  const makeController = (webhookSecret?: string) =>
    new PaymentsController(
      { findOne: mockFindOne } as unknown as PaymentsService,
      {
        createPreference: mockCreatePreference,
        handleWebhook: mockHandleWebhook,
      } as unknown as MercadoPagoService,
      {
        get: (key: string) =>
          key === 'MP_WEBHOOK_SECRET' ? webhookSecret : undefined,
      } as unknown as ConfigService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockHandleWebhook.mockResolvedValue({ received: true });
  });

  describe('createPreference (IDOR)', () => {
    it('verifica la propiedad de la reserva antes de crear la preferencia', async () => {
      mockFindOne.mockResolvedValue({ id: 'pay-1' });
      mockCreatePreference.mockResolvedValue({ init_point: 'url' });

      const req = { user: { sub: 'user-1' } } as never;
      await makeController().createPreference('pay-1', req);

      expect(mockFindOne).toHaveBeenCalledWith('pay-1', 'user-1');
      expect(mockCreatePreference).toHaveBeenCalledWith('pay-1');
    });

    it('no crea la preferencia si el pago no pertenece al usuario', async () => {
      mockFindOne.mockRejectedValue(new UnauthorizedException());

      await expect(
        makeController().createPreference('pay-1', {
          user: { sub: 'user-2' },
        } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockCreatePreference).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook (firma MP)', () => {
    const body = { type: 'payment', data: { id: 'mp-1' } };

    it('rechaza con 401 si el secreto está seteado y la firma no coincide', () => {
      const req = {
        headers: { 'x-signature': 'ts=1,v1=falsa', 'x-request-id': 'r' },
        query: { 'data.id': 'mp-1' },
      } as never;

      expect(() => makeController('secreto').handleWebhook(req, body)).toThrow(
        UnauthorizedException,
      );
      expect(mockHandleWebhook).not.toHaveBeenCalled();
    });

    it('acepta una firma válida', () => {
      const v1 = createHmac('sha256', 'secreto')
        .update('id:mp-1;request-id:r;ts:1;')
        .digest('hex');
      const req = {
        headers: { 'x-signature': `ts=1,v1=${v1}`, 'x-request-id': 'r' },
        query: {},
      } as never;

      expect(makeController('secreto').handleWebhook(req, body)).toBeDefined();
      expect(mockHandleWebhook).toHaveBeenCalledWith(body);
    });

    it('procesa sin firma cuando no hay secreto configurado (dev)', () => {
      const req = { headers: {}, query: {} } as never;

      expect(makeController().handleWebhook(req, body)).toBeDefined();
      expect(mockHandleWebhook).toHaveBeenCalledWith(body);
    });

    it('ignora bodies sin type válido sin tocar a MP', () => {
      const req = { headers: {}, query: {} } as never;

      expect(makeController().handleWebhook(req, {})).toEqual({
        received: true,
      });
      expect(mockHandleWebhook).not.toHaveBeenCalled();
    });
  });
});
