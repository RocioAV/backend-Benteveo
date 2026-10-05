import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/user.types';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiriesService } from './inquiries.service';

@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Post()
  create(
    @Body() dto: CreateInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inquiriesService.create(dto.productId, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.inquiriesService.findAll(user);
  }

  @Get(':id/messages')
  getHistory(
    @Param('id', ParseUUIDPipe) inquiryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inquiriesService.getHistory(inquiryId, user);
  }

  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) inquiryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inquiriesService.getOne(inquiryId, user);
  }
}
