import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InquiriesModule } from '../inquiries/inquiries.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, InquiriesModule, ReservationsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
