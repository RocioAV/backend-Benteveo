import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { MAX_MESSAGE_LENGTH } from '../chat.constants';

export class SendMessageDto {
  @IsUUID('4')
  reservationId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'content must contain a non-whitespace character' })
  @MaxLength(MAX_MESSAGE_LENGTH)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientMessageId?: string;
}
