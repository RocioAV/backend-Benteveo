import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('mis-publicaciones')
  findMyPublications(@Req() req: any) {
    return this.dashboardService.findMyPublications(req.user.sub);
  }

  @Get('mis-alquileres')
  findMyRentals(@Req() req: any) {
    return this.dashboardService.findMyRentals(req.user.sub);
  }

  @Get('mis-prestamos')
  findMyLoans(@Req() req: any) {
    return this.dashboardService.findMyLoans(req.user.sub);
  }
}
