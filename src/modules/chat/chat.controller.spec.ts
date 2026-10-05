import { ChatController } from './chat.controller';
import type { ChatService } from './chat.service';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { Role } from '../../common/types/user.types';

describe('ChatController', () => {
  it('passes the authenticated user to the authorized history service', async () => {
    const getHistory = jest.fn().mockResolvedValue([]);
    const service = { getHistory } as unknown as ChatService;
    const controller = new ChatController(service);
    const user: AuthenticatedUser = {
      sub: 'user-1',
      email: 'user@example.com',
      role: Role.USER,
    };

    await controller.getHistory('reservation-1', user);

    expect(getHistory).toHaveBeenCalledWith('reservation-1', user);
  });
});
