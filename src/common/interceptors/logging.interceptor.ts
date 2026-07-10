import {
  Injectable, // Decorador que permite que esta clase sea inyectada como dependencia
  NestInterceptor, // Interfaz que define la estructura de un interceptor
  ExecutionContext, // Proporciona información sobre el contexto de ejecución actual
  CallHandler, // ermite continuar con la ejecución del siguiente handler
} from '@nestjs/common';
import { Observable } from 'rxjs'; 
// Operador de RxJS que permite ejecutar efectos secundarios sin modificar el flujo
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    console.log(`📥 Entrada: ${method} ${url}`);

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - now;
        console.log(`📤 Salida: ${method} ${url} - ${responseTime}ms`);
      }),
    );
  }
}