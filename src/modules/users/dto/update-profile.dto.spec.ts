import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto (partial)', () => {
  it('accepts a payload with only name', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: 'Juan Perez' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts an empty payload', async () => {
    const dto = plainToInstance(UpdateProfileDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('still validates a present invalid field', async () => {
    const dto = plainToInstance(UpdateProfileDto, { name: 'Jo' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });
});
