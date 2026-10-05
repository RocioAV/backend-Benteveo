import { IsUUID } from 'class-validator';

export class LeaveChatDto {
  @IsUUID('4')
  reservationId!: string;
}
