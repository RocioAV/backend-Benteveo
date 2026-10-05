import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './modules/users/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ValidationPipe } from './common/pipes/validation.pipe';
import { PrismaModule } from './prisma/prisma.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { KycGuard } from './common/guards/kyc.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { JwtModule } from '@nestjs/jwt';
// import { NoteModule } from './note/note.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ProductsModule } from './modules/products/products.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
import { VerificationModule } from './modules/verification/verification.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { AiModule } from './modules/ai/ai.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ChatModule } from './modules/chat/chat.module';
import { InquiriesModule } from './modules/inquiries/inquiries.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ?? '60m') as
            | `${number}s`
            | `${number}m`
            | `${number}h`
            | `${number}d`,
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
    VerificationModule,
    PaymentsModule,
    FavoritesModule,
    ReviewsModule,
      AiModule,
      InquiriesModule,
      ChatModule,
    // StripeModule,
    // SubscriptionModule,
  ],
  // controllers: [WebhookController],
  providers: [
    // Filtro global único (catch-all) que absorbe errores HTTP, AppException y Prisma
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
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
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: KycGuard,
    },
    // Interceptor global de logging
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
