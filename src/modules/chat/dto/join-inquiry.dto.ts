import { IsUUID } from 'class-validator';

export class JoinInquiryDto {
  @IsUUID('4')
  inquiryId!: string;
}
