import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import './cloudinary.config';

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
    options: { folder?: string } = {},
  ): Promise<UploadApiResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: options.folder ?? 'benteveo',
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new BadRequestException(
                `Error al subir la imagen a Cloudinary: ${
                  error?.message ?? 'sin detalles del error'
                }`,
              ),
            );
          } else {
            resolve(result);
          }
        },
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!publicId) {
      return;
    }
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok') {
      throw new BadRequestException(
        `No se pudo eliminar la imagen ${publicId}`,
      );
    }
  }
}
