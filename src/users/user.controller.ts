import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe, HttpCode, HttpStatus, Query, Req, BadRequestException, UseInterceptors, UploadedFile} from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service'; 
import { CreateUserDto } from './dto/create-user.dto'; 
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/types/admin.types';
import { Public } from '../common/decorators/public.decorator';

@Controller('user')
export class UserController {
  constructor(
    // private readonly cloudinaryService: CloudinaryService,
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Public()
  @UsePipes(new ValidationPipe())
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  // @Post('upload-avatar')
  // @UsePipes(new ValidationPipe())
  // @UseInterceptors(FileInterceptor('file'))
  // async uploadAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    
  //   if (!file) throw new BadRequestException('No se envió ninguna imagen');

  //   // 1. Subir a Cloudinary y obtener URL
  //   const imageUrl = await this.cloudinaryService.uploadImage(file);

  //   // 2. Guardar SOLO LA URL en la base de datos
  //   await this.prisma.profile.update({
  //     where: { userId: req.user.sub },
  //     data: { avatar: imageUrl },
  //   });

  //   return { 
  //     message: 'Avatar actualizado', 
  //     url: imageUrl 
  //   };
  // }



  // // @UseGuards(AuthGuard, RolesGuard)
  // // @Roles(Role.ADMIN)
  @Get()
  @Public()
  async findAll() {
    return await this.userService.findAll();
  }

  @Get('profile')
  async getProfile(@Req() req: any){
    const userId = req.user.id;
    return await this.userService.findOne(userId);
  }
  

  @Get('data-user') 
  @UsePipes(new ValidationPipe())
  @HttpCode(HttpStatus.OK)
  async getMyProfile(@Req() req: any) {
      return this.userService.getUserWithProfile(req.user.sub);
  }


  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return await this.userService.findOne(id);
  }


  // @Patch(':id')
  // @Roles(Role.ADMIN)
  // @UsePipes(new ValidationPipe())
  // async update(
  //   @Param('id') id: string,
  //   @Body() updateUserDto: UpdateUserDto,
  // ) {
  //   return await this.userService.update(id, updateUserDto);
  // }

  @Delete('delete')
  @Roles(Role.ADMIN, Role.MODERATOR, Role.USER)
  @UsePipes(new ValidationPipe())
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: any) {
    const idUser = req.user.sub;

    return await this.userService.remove(idUser);
  }
}