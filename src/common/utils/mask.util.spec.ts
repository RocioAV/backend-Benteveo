import { maskDni, maskEmail } from './mask.util';

describe('maskEmail', () => {
  it('enmascara la parte local manteniendo el dominio', () => {
    expect(maskEmail('juan.perez@example.com')).toBe('j***z@example.com');
  });

  it('maneja emails cortos y malformados', () => {
    expect(maskEmail('ab@x.com')).toBe('a*@x.com');
    expect(maskEmail('sin-arroba')).toBe('***');
  });
});

describe('maskDni', () => {
  it('conserva solo los últimos 4 dígitos', () => {
    expect(maskDni('30111222')).toBe('****1222');
    expect(maskDni('30.111.222')).toBe('****1222');
  });

  it('enmascara DNIs cortos por completo', () => {
    expect(maskDni('123')).toBe('***');
  });
});
