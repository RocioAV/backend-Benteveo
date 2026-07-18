import { Controller, Get, Param, Delete, UsePipes, ValidationPipe, HttpCode, HttpStatus, Req, Patch } from '@nestjs/common';
import { UserService } from './user.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/admin.types';
import { Public } from '../../common/decorators/public.decorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Public()
  async findAll() {
    return await this.userService.findAll();
  }

  @Get('profile')
  async getProfile(@Req() req: any) {
    const userId = req.user.sub;
    return await this.userService.findOne(userId);
  }

  @Get('data-user')
  @HttpCode(HttpStatus.OK)
  async getMyProfile(@Req() req: any) {
    return this.userService.getUserWithProfile(req.user.sub);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }

  @Patch('delete')
  @Roles(Role.ADMIN, Role.MODERATOR, Role.USER)
  @UsePipes(new ValidationPipe())
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: any) {
    const idUser = req.user.sub;
    return await this.userService.remove(idUser);
  }
}
