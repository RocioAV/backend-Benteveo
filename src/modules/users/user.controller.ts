import { Controller, Get, Param, UsePipes, ValidationPipe, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { UserService } from './user.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/admin.types';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll() {
    return await this.userService.findAll();
  }

  @Get('profile')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return await this.userService.findOne(user.sub);
  }

  @Get('data-user')
  @HttpCode(HttpStatus.OK)
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getUserWithProfile(user.sub);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return await this.userService.findPublicProfile(id);
  }

  @Patch('delete')
  @Roles(Role.ADMIN, Role.MODERATOR, Role.USER)
  @UsePipes(new ValidationPipe())
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: AuthenticatedUser) {
    return await this.userService.remove(user.sub);
  }
}
