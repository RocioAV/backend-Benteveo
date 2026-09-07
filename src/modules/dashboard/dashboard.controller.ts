import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('publications')
  findMyPublications(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.findMyPublications(user.sub);
  }

  @Get('rentals')
  findMyRentals(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.findMyRentals(user.sub);
  }

  @Get('loans')
  findMyLoans(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.findMyLoans(user.sub);
  }
}
