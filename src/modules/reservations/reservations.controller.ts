import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { FindReservationsDto } from './dto/find-reservations.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/user.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReservationDto, @Req() req: any) {
    return this.reservationsService.create(dto, req.user.sub);
  }

  @Get()
  findMyReservations(@Req() req: any) {
    return this.reservationsService.findMyReservations(req.user.sub);
  }

  @Get('as-owner')
  findAsOwner(@Req() req: any) {
    return this.reservationsService.findAsOwner(req.user.sub);
  }

  @Get('all')
  @Roles(Role.ADMIN)
  findAll(@Query() filters: FindReservationsDto) {
    return this.reservationsService.findAll(filters);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reservationsService.findOne(id, user);
  }

  @Patch(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.reservationsService.confirm(id, req.user.sub);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.reservationsService.cancel(id, req.user.sub);
  }

  @Patch(':id/handoff')
  handoff(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body('notes') notes?: string,
  ) {
    return this.reservationsService.handoff(id, req.user.sub, notes);
  }

  @Patch(':id/return')
  returnProduct(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.reservationsService.returnProduct(id, req.user.sub);
  }
}
