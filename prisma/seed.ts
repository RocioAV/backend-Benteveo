import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const email = 'admin@benteveo.com';
  const password = 'Admin1234!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuario admin ya existe: ${email} (id: ${existing.id})`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin Benteveo',
      email,
      password: hashedPassword,
      dni: '00000000',
      isIdentityVerified: true,
      role: JSON.stringify(['ADMIN']),
      profile: {
        create: {
          phone: '+5491100000000',
          description: 'Administrador del sistema',
        },
      },
    },
  });

  console.log('Admin creado exitosamente:');
  console.log(`  id:    ${admin.id}`);
  console.log(`  email: ${email}`);
  console.log(`  pass:  ${password}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
