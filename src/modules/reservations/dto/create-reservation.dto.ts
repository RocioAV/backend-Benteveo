import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsDateString()
  dateInit!: string;

  @IsDateString()
  dateEnd!: string;
}
