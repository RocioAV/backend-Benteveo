import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ReservationStatus } from '@prisma/client';

export class FindReservationsDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  productId?: string;

  @IsEnum(ReservationStatus)
  @IsOptional()
  status?: ReservationStatus;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;
}
