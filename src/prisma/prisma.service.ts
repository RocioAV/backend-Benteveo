import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;

  constructor() {
    // 1. Creamos el pool con la variable de entorno
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    // 2. Se lo pasamos al constructor de PrismaClient
    super({ adapter });
    
    this.pool = pool;
  }

  async onModuleInit() {
    // Con adaptadores, Prisma se conecta automáticamente al realizar la primera consulta.
    // No hace falta llamar a un método $connect().
  }

  async onModuleDestroy() {
    // 3. Cerramos el pool de conexiones limpiamente cuando NestJS se apague
    await this.pool.end();
  }
}