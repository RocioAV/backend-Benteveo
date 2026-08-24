import { FileValidator } from '@nestjs/common';

export interface ImageFileValidatorOptions {
  allowedMimeTypes: string[];
}

export class ImageFileValidator extends FileValidator<ImageFileValidatorOptions> {
  buildErrorMessage(): string {
    return 'Solo se permiten imágenes en formato JPG, JPEG, PNG o WEBP';
  }

  isValid(file?: Express.Multer.File): boolean {
    return (
      !!file && this.validationOptions.allowedMimeTypes.includes(file.mimetype)
    );
  }
}
