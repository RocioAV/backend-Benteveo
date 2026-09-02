import { IsString, IsNotEmpty } from 'class-validator';

export class RejectVerificationDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio' })
  reviewNotes: string;
}
