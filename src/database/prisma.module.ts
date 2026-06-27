import { Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

@Module({
    providers: [PrismaService],
    exports: [PrismaService], // Esto sigue siendo OBLIGATORIO para poder compartirlo
})
export class PrismaModule { }
