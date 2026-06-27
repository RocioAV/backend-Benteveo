import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UserService } from './user.service'; 
import { UserController } from './user.controller';
import { RequestIdMiddleware } from 'src/common/middleware/request-id.middleware';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    CloudinaryService,
  ],
  exports: [UserService],
})
export class UserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes(UserController);
  }
}