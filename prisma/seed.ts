import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

// Catálogo de productos demo, alineado con las 7 categorías del frontend.
// Las URLs de foto son placeholders (picsum) — se reemplazan por Cloudinary
// cuando los productos reales se carguen vía POST /products + upload.
const PRODUCTS = [
  // Aire libre
  { title: 'Carpa 4 personas', category: 'Aire libre', priceDay: 3500, priceMonth: 42000, deposit: 25000, zone: 'CABA', city: 'Palermo', state: 'CABA', address: 'Av. Santa Fe 3200', descripcion: 'Carpa impermeable para 4 personas, ideal para camping. Incluye bolso de transporte.', photo: 'https://picsum.photos/seed/benteveo-carpa/800/600' },
  { title: 'Gazebo plegable 3x3', category: 'Aire libre', priceDay: 4000, priceMonth: 48000, deposit: 30000, zone: 'CABA', city: 'Belgrano', state: 'CABA', address: 'Av. Cabildo 1800', descripcion: 'Gazebo plegable con estructura de acero y techo impermeable. Fácil de armar.', photo: 'https://picsum.photos/seed/benteveo-gazebo/800/600' },
  // Cumpleaños y celebraciones
  { title: 'Castillo inflable', category: 'Cumpleaños y celebraciones', priceDay: 6000, priceMonth: 70000, deposit: 50000, zone: 'CABA', city: 'Palermo', state: 'CABA', address: 'Costa Rica 4500', descripcion: 'Castillo inflable para cumpleaños infantiles. Incluye inflador y lona de seguridad.', photo: 'https://picsum.photos/seed/benteveo-castillo/800/600' },
  { title: 'Máquina de pochoclos', category: 'Cumpleaños y celebraciones', priceDay: 2500, priceMonth: 30000, deposit: 15000, zone: 'CABA', city: 'Villa Crespo', state: 'CABA', address: 'Av. Corrientes 5600', descripcion: 'Máquina de pochoclos profesional, ideal para fiestas y eventos. Fácil de limpiar.', photo: 'https://picsum.photos/seed/benteveo-pochoclos/800/600' },
  // Electrodomésticos
  { title: 'Aspiradora multiuso', category: 'Electrodomésticos', priceDay: 1500, priceMonth: 18000, deposit: 12000, zone: 'CABA', city: 'Caballito', state: 'CABA', address: 'Av. Rivadavia 5200', descripcion: 'Aspiradora multiuso con filtro HEPA, ideal para limpieza profunda de tapizados y pisos.', photo: 'https://picsum.photos/seed/benteveo-aspiradora/800/600' },
  { title: 'Conservadora portátil', category: 'Electrodomésticos', priceDay: 2000, priceMonth: 24000, deposit: 16000, zone: 'CABA', city: 'Recoleta', state: 'CABA', address: 'Av. Pueyrredón 2100', descripcion: 'Conservadora eléctrica portátil 12/220v, mantiene frío por horas. Ideal viajes y eventos.', photo: 'https://picsum.photos/seed/benteveo-conservadora/800/600' },
  // Electrónica
  { title: 'Proyector Full HD', category: 'Electrónica', priceDay: 4500, priceMonth: 54000, deposit: 40000, zone: 'CABA', city: 'Palermo', state: 'CABA', address: 'Honduras 3700', descripcion: 'Proyector Full HD con HDMI, ideal para cine en casa o presentaciones. Incluye control remoto.', photo: 'https://picsum.photos/seed/benteveo-proyector/800/600' },
  { title: 'Parlante Bluetooth 100W', category: 'Electrónica', priceDay: 1800, priceMonth: 21600, deposit: 14000, zone: 'CABA', city: 'Almagro', state: 'CABA', address: 'Av. Corrientes 3200', descripcion: 'Parlante Bluetooth portátil de 100W con batería de larga duración y luces LED.', photo: 'https://picsum.photos/seed/benteveo-parlante/800/600' },
  // Herramientas
  { title: 'Taladro percutor 800W', category: 'Herramientas', priceDay: 1200, priceMonth: 14400, deposit: 10000, zone: 'CABA', city: 'Flores', state: 'CABA', address: 'Av. Rivadavia 6800', descripcion: 'Taladro percutor de 800W con mechas incluidas. Ideal para obra y bricolaje.', photo: 'https://picsum.photos/seed/benteveo-taladro/800/600' },
  { title: 'Soldadora inverter 200A', category: 'Herramientas', priceDay: 3000, priceMonth: 36000, deposit: 35000, zone: 'CABA', city: 'Mataderos', state: 'CABA', address: 'Av. Juan B. Alberdi 5200', descripcion: 'Soldadora inverter de 200A con pinza y máscara. Para trabajos de herrería y reparación.', photo: 'https://picsum.photos/seed/benteveo-soldadora/800/600' },
  // Jardinería
  { title: 'Bordeadora eléctrica', category: 'Jardinería', priceDay: 1500, priceMonth: 18000, deposit: 12000, zone: 'Zona Norte', city: 'San Isidro', state: 'Buenos Aires', address: 'Av. del Libertador 16000', descripcion: 'Bordeadora eléctrica con hilo de nylon, ideal para mantener prolijos los bordes del jardín.', photo: 'https://picsum.photos/seed/benteveo-bordeadora/800/600' },
  { title: 'Desmalezadora a explosión', category: 'Jardinería', priceDay: 2200, priceMonth: 26400, deposit: 18000, zone: 'Zona Norte', city: 'Tigre', state: 'Buenos Aires', address: 'Av. Cazón 1500', descripcion: 'Desmalezadora a explosión para terrenos grandes y maleza densa. Incluye arnés y cuchilla.', photo: 'https://picsum.photos/seed/benteveo-desmalezadora/800/600' },
  // Muebles
  { title: 'Mesa de luz nórdica', category: 'Muebles', priceDay: 800, priceMonth: 9600, deposit: 8000, zone: 'CABA', city: 'Palermo', state: 'CABA', address: 'Gurruchaga 1800', descripcion: 'Mesa de luz de estilo nórdico en madera clara. Ideal para ambientar espacios.', photo: 'https://picsum.photos/seed/benteveo-mesadeluz/800/600' },
  { title: 'Sillón de lectura', category: 'Muebles', priceDay: 2500, priceMonth: 30000, deposit: 25000, zone: 'CABA', city: 'Colegiales', state: 'CABA', address: 'Av. Federico Lacroze 2400', descripcion: 'Sillón individual cómodo con apoyabrazos, ideal para rincones de lectura.', photo: 'https://picsum.photos/seed/benteveo-sillon/800/600' },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // 1. Usuario admin (idempotente)
  const adminEmail = 'admin@benteveo.com';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Admin Benteveo',
      email: adminEmail,
      password: await bcrypt.hash('Admin1234!', 10),
      dni: '00000000',
      isIdentityVerified: true,
      role: 'ADMIN',
      profile: { create: { phone: '+5491100000000', description: 'Administrador del sistema' } },
    },
  });
  console.log(`✓ Admin listo: ${adminEmail}`);

  // 2. Propietaria demo (dueña de los productos)
  const ownerEmail = 'propietaria@benteveo.com';
  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      name: 'Lucía Propietaria',
      email: ownerEmail,
      password: await bcrypt.hash('Propietaria123!', 10),
      dni: '11111111',
      isIdentityVerified: true,
      role: 'USER',
      profile: { create: { phone: '+5491100000001', description: 'Propietaria demo de Benteveo' } },
    },
  });
  console.log(`✓ Propietaria listo: ${ownerEmail}`);

  // 3. Productos (idempotente: no re-crea si ya hay)
  const productCount = await prisma.product.count();
  if (productCount > 0) {
    console.log(`→ Ya existen ${productCount} productos; se saltea el seed de productos.`);
  } else {
    for (const p of PRODUCTS) {
      const product = await prisma.product.create({
        data: {
          title: p.title,
          descripcion: p.descripcion,
          priceDay: p.priceDay,
          priceMonth: p.priceMonth,
          zone: p.zone,
          city: p.city,
          state: p.state,
          address: p.address,
          deposit: p.deposit,
          category: p.category,
          ownerId: owner.id,
          isAvailable: true,
          photos: {
            create: {
              url: p.photo,
              publicId: `seed-${p.title.toLowerCase().replace(/\s+/g, '-')}`,
            },
          },
        },
      });
      console.log(`  ✓ ${product.title}`);
    }
    console.log(`${PRODUCTS.length} productos creados.`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
