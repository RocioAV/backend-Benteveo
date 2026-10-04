import { Role } from './user.types';

describe('Role enum (unificado)', () => {
  it('expone exactamente USER y ADMIN, sin MODERATOR', () => {
    expect(Object.values(Role).sort()).toEqual(['ADMIN', 'USER']);
  });

  it('mantiene los valores de cadena estables', () => {
    expect(Role.USER).toBe('USER');
    expect(Role.ADMIN).toBe('ADMIN');
  });

  it('no declara ningún miembro más que USER y ADMIN', () => {
    expect(Object.keys(Role)).toHaveLength(2);
    expect(Role).not.toHaveProperty('MODERATOR');
  });
});
