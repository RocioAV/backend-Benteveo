import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdateReservationDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  actualHandoffAt?: string;

  @IsDateString()
  @IsOptional()
  actualReturnAt?: string;

  @IsString()
  @IsOptional()
  handoffNotes?: string;
}
