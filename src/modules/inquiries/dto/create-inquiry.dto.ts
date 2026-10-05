import { IsUUID } from 'class-validator';

export class CreateInquiryDto {
  @IsUUID('4')
  productId!: string;
}
