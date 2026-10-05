import { IsUUID } from 'class-validator';

export class LeaveInquiryDto {
  @IsUUID('4')
  inquiryId!: string;
}
