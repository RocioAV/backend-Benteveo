import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { RESERVATIONS_SERVICE } from './reservations.tokens';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    { provide: RESERVATIONS_SERVICE, useExisting: ReservationsService },
  ],
  exports: [ReservationsService, RESERVATIONS_SERVICE],
})
export class ReservationsModule {}
