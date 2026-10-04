import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ParseIntValidationPipe implements PipeTransform<string, number> {
  transform(value: string, _metadata: ArgumentMetadata): number {
    const val = parseInt(value, 10);

    if (isNaN(val) || val < 1) {
      throw new BadRequestException(
        `El valor "${value}" debe ser un número entero positivo`,
      );
    }

    return val;
  }
}
