import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './modules/users/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { PrismaModule } from './prisma/prisma.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { JwtModule } from '@nestjs/jwt';
// import { NoteModule } from './note/note.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ProductsModule } from './modules/products/products.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
            '60m') as `${number}s` | `${number}m` | `${number}h` | `${number}d`,
        },
      }),
    }),
    UserModule,
    AuthModule,
    PrismaModule,
    // NoteModule,
    ProfileModule,
    ProductsModule,
    ReservationsModule,
    CloudinaryModule,
    // StripeModule,
    // SubscriptionModule,
  ],
  // controllers: [WebhookController],
  providers: [
    // Filtros globales
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // Filtro para errores de Prisma
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    // Pipes globales
    // Transformar y validar automáticamente los DTOs.
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
    // Guards globales
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}