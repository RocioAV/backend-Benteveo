/**
 * Bootstrap ADMIN — Script protegido por flag.
 *
 * Uso:  ADMIN_BOOTSTRAP=true ADMIN_EMAIL=x ADMIN_PASSWORD=y pnpm bootstrap:admin
 *
 * Requiere las tres variables de entorno; si falta alguna, aborta sin efecto.
 * Hashea la contraseña con bcrypt y upserta el usuario con role ADMIN.
 * Ningún endpoint público eleva rol — este es el único camino controlado.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

function abort(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function main() {
  // ── Flag guard ──────────────────────────────────────────────────────
  if (process.env.ADMIN_BOOTSTRAP !== 'true') {
    abort(
      'ADMIN_BOOTSTRAP no es "true". Establece ADMIN_BOOTSTRAP=true para ejecutar.',
    );
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email) abort('ADMIN_EMAIL no está definido.');
  if (!password) abort('ADMIN_PASSWORD no está definido.');
  if (password.length < 8) abort('ADMIN_PASSWORD debe tener al menos 8 caracteres.');

  // ── DB connection ───────────────────────────────────────────────────
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN', password: hashedPassword },
      create: {
        name: 'Admin',
        email,
        password: hashedPassword,
        dni: '00000000',
        role: 'ADMIN',
        isIdentityVerified: true,
        profile: {
          create: { phone: '', description: 'Administrador del sistema' },
        },
      },
      omit: { password: true },
    });

    console.log(`✅ Admin bootstrap exitoso: ${user.email} (role: ${user.role})`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
