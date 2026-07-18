import {
  IsString,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsOptional,
  IsUrl,
  IsNotEmpty,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  @IsNumber()
  @IsPositive()
  priceDay!: number;

  @IsNumber()
  @IsPositive()
  priceMonth!: number;

  @IsString()
  @IsNotEmpty()
  zone!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  urlPhoto!: string;

  @IsNumber()
  @IsPositive()
  deposit!: number;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
