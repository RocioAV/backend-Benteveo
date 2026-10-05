import { FileValidator } from '@nestjs/common';

export interface ImageFileValidatorOptions {
  allowedMimeTypes: string[];
  maxFileSize?: number;
}

export class ImageFileValidator extends FileValidator<ImageFileValidatorOptions> {
  buildErrorMessage(file?: Express.Multer.File): string {
    const { maxFileSize } = this.validationOptions;
    if (
      maxFileSize &&
      file &&
      typeof file.size === 'number' &&
      file.size > maxFileSize
    ) {
      const mb = Math.round(maxFileSize / (1024 * 1024));
      return `La imagen no puede superar ${mb} MB`;
    }
    return 'Solo se permiten imágenes en formato JPG, JPEG, PNG o WEBP';
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file) return false;
    const { allowedMimeTypes, maxFileSize } = this.validationOptions;
    if (!allowedMimeTypes.includes(file.mimetype)) return false;
    if (
      maxFileSize &&
      typeof file.size === 'number' &&
      file.size > maxFileSize
    ) {
      return false;
    }
    return true;
  }
}
