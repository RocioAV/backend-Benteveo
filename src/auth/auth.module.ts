import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../users/user.module'; 
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy'; 
import { AuthController } from './auth.controller';
import {
  ConfigService, ConfigModule
} from '@nestjs/config'
import { ProfileModule } from '@/profile/profile.module'; 
import { AuthGuard } from '../common/guards/auth.guard'; 

@Module({
  imports: [
    ConfigModule,
    UserModule,
    ProfileModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '60m'}
    })
  })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthGuard],
  exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}
