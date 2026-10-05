import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @IsIn(['user', 'model'])
  role: 'user' | 'model';

  @IsString()
  @MaxLength(2000)
  text: string;
}

export class ChatProductContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000000)
  pricePerDay?: number;
}

export class ChatContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  page?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatProductContextDto)
  product?: ChatProductContextDto;
}

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatContextDto)
  context?: ChatContextDto;
}
