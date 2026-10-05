import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { ChatService } from './chat.service';

@Controller('reservations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':reservationId/messages')
  getHistory(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chatService.getHistory(reservationId, user);
  }
}
