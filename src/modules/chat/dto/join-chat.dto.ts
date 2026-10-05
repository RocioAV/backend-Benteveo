import { IsUUID } from 'class-validator';

export class JoinChatDto {
  @IsUUID('4')
  reservationId!: string;
}
