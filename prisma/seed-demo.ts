/**
 * Seed demo — datos de demostración para el Home de Benteveo.
 *
 * Contraseña de prueba para TODOS los usuarios: Demo1234!
 *
 * Ejecutar: npx ts-node prisma/seed-demo.ts
 * Idempotente: se puede ejecutar varias veces sin duplicar registros.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';

const PASSWORD = 'Demo1234!';
const SALT_ROUNDS = 10;

// ─── IMÁGENES ───────────────────────────────────────────────────────────
// REEMPLAZAR AQUÍ con las URLs reales de los productos extra.
// Los placeholders de placehold.co son TEMPORALES y deben sustituirse
// antes del deploy.
const IMAGENES = {
  // — Las 10 que existen en frontend-benteveo/public/images/ —
  taladro: '/images/taladro.webp',
  escalera: '/images/escalera.webp',
  bordeadora: '/images/bordeadora-electrica.webp',
  cortadora: '/images/cortadora-de-cesped.webp',
  carpa: '/images/carpa.webp',
  conservadora: '/images/conservadora-portatil.webp',
  metegol: '/images/metegol.webp',
  camaElastica: '/images/cama-elastica.webp',
  aspiradora: '/images/aspiradora-multiuso.webp',
  maquinaCoser: '/images/maquina-de-coser.webp',
  // — Galerías con 4 fotos reales en frontend-benteveo/public/images/ —
  camara: '/images/camara-dslr-1.webp',
  drone: '/images/drone-4k-1.webp',
  raqueta: '/images/raquetas-padel-1.webp',
};

// ─── GALERÍAS (título exacto del producto → fotos a cargar) ──────────────
// Solo se aplican si TODAS las fotos actuales del producto son placeholders
// (picsum.photos / placehold.co) o si el producto no tiene fotos.
// Si alguna foto es de Cloudinary o local (/images/...), el producto se salta.
const GALERIAS: Record<string, string[]> = {
  // — 4 fotos reales nuevas (copiadas a public/images/) —
  'Cámara DSLR con lente 18-55': [
    '/images/camara-dslr-1.webp',
    '/images/camara-dslr-2.webp',
    '/images/camara-dslr-3.webp',
    '/images/camara-dslr-4.webp',
  ],
  'Drone con cámara 4K': [
    '/images/drone-4k-1.webp',
    '/images/drone-4k-2.webp',
    '/images/drone-4k-3.webp',
    '/images/drone-4k-4.webp',
  ],
  'Pack raquetas de pádel': [
    '/images/raquetas-padel-1.webp',
    '/images/raquetas-padel-2.webp',
    '/images/raquetas-padel-3.webp',
    '/images/raquetas-padel-4.webp',
  ],
  'Gazebo plegable 3x3': [
    '/images/gazebo-plegable-1.webp',
    '/images/gazebo-plegable-2.webp',
    '/images/gazebo-plegable-3.webp',
    '/images/gazebo-plegable-4.webp',
  ],
  'Castillo inflable': [
    '/images/castillo-inflable-1.webp',
    '/images/castillo-inflable-2.webp',
    '/images/castillo-inflable-3.webp',
    '/images/castillo-inflable-4.webp',
  ],
  'Máquina de pochoclos': [
    '/images/maquina-pochoclos-1.webp',
    '/images/maquina-pochoclos-2.webp',
    '/images/maquina-pochoclos-3.webp',
    '/images/maquina-pochoclos-4.webp',
  ],
  'Proyector Full HD': [
    '/images/proyector-fullhd-1.webp',
    '/images/proyector-fullhd-2.webp',
    '/images/proyector-fullhd-3.webp',
    '/images/proyector-fullhd-4.webp',
  ],
  'Parlante Bluetooth 100W': [
    '/images/parlante-bluetooth-1.webp',
    '/images/parlante-bluetooth-2.webp',
    '/images/parlante-bluetooth-3.webp',
    '/images/parlante-bluetooth-4.webp',
  ],
  'Soldadora inverter 200A': [
    '/images/soldadora-inverter-1.webp',
    '/images/soldadora-inverter-2.webp',
    '/images/soldadora-inverter-3.webp',
    '/images/soldadora-inverter-4.webp',
  ],
  'Desmalezadora a explosión': [
    '/images/desmalezadora-1.webp',
    '/images/desmalezadora-2.webp',
    '/images/desmalezadora-3.webp',
    '/images/desmalezadora-4.webp',
  ],
  'Mesa de luz nórdica': [
    '/images/mesa-de-luz-1.webp',
    '/images/mesa-de-luz-2.webp',
    '/images/mesa-de-luz-3.webp',
    '/images/mesa-de-luz-4.webp',
  ],
  'Sillón de lectura': [
    '/images/sillon-lectura-1.webp',
    '/images/sillon-lectura-2.webp',
    '/images/sillon-lectura-3.webp',
    '/images/sillon-lectura-4.webp',
  ],
  // — 1 foto local existente —
  'Carpa 4 personas': ['/images/carpa.webp'],
  'Aspiradora multiuso': ['/images/aspiradora-multiuso.webp'],
  'Conservadora portátil': ['/images/conservadora-portatil.webp'],
  'Taladro percutor 800W': ['/images/taladro.webp'],
  'Bordeadora eléctrica': ['/images/bordeadora-electrica.webp'],
};

/** Slug de respaldo cuando el título no está en PRODUCTS (p. ej. productos ya existentes en la DB). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ─── USUARIOS (6) ───────────────────────────────────────────────────────
// Emails y DNI distintos entre sí; evitan propietaria@benteveo.com (seed.ts)
// y dni 00000000 / 11111111 (bootstrap-admin / seed.ts).
const USERS = [
  {
    name: 'Carlos Herrero',
    email: 'herramientas@benteveo-demo.com',
    dni: '22222222',
    phone: '+5491122220001',
    profileDesc: 'Dueño de herramientas y jardinería',
  },
  {
    name: 'Laura Camping',
    email: 'camping@benteveo-demo.com',
    dni: '33333333',
    phone: '+5491133330002',
    profileDesc: 'Dueña de equipamiento de aire libre y fiestas',
  },
  {
    name: 'Juan Pérez',
    email: 'juan@benteveo-demo.com',
    dni: '44444444',
    phone: '+5491144440003',
    profileDesc: 'Inquilino frecuente',
  },
  {
    name: 'María Gómez',
    email: 'maria@benteveo-demo.com',
    dni: '55555555',
    phone: '+5491155550004',
    profileDesc: 'Alquila para eventos familiares',
  },
  {
    name: 'Sofía Foto',
    email: 'fotografia@benteveo-demo.com',
    dni: '66666666',
    phone: '+5491166660005',
    profileDesc: 'Dueña de equipo fotográfico y deportivo',
  },
  {
    name: 'Pedro Ruiz',
    email: 'pedro@benteveo-demo.com',
    dni: '77777777',
    phone: '+5491177770006',
    profileDesc: 'Alquila para salidas y deporte',
  },
];

// ─── PRODUCTOS (13: 10 con imagen local + 3 placeholders) ──────────────
const PRODUCTS = [
  // Owner: herramientas
  {
    title: 'Taladro inalámbrico 18V',
    slug: 'taladro-inalambrico',
    ownerEmail: 'herramientas@benteveo-demo.com',
    category: 'Herramientas',
    priceDay: 200,
    priceMonth: 54000,
    deposit: 100,
    zone: 'CABA',
    city: 'Caballito',
    state: 'CABA',
    address: 'Av. Rivadavia 5400',
    descripcion:
      'Taladro inalámbrico 18V con 2 baterías y set de mechas. Ideal para obra y bricolaje.',
    imageUrl: IMAGENES.taladro,
  },
  {
    title: 'Escalera plegable 5 metros',
    slug: 'escalera-plegable',
    ownerEmail: 'herramientas@benteveo-demo.com',
    category: 'Herramientas',
    priceDay: 300,
    priceMonth: 42000,
    deposit: 100,
    zone: 'CABA',
    city: 'Caballito',
    state: 'CABA',
    address: 'Av. Rivadavia 5400',
    descripcion:
      'Escalera plegable de aluminio de 5 metros. Liviana, resistente y fácil de transportar.',
    imageUrl: IMAGENES.escalera,
  },
  {
    title: 'Bordeadora con hilo de nylon',
    slug: 'bordeadora-hilo',
    ownerEmail: 'herramientas@benteveo-demo.com',
    category: 'Jardinería',
    priceDay: 600,
    priceMonth: 72000,
    deposit: 1,
    zone: 'CABA',
    city: 'Caballito',
    state: 'CABA',
    address: 'Av. Rivadavia 5400',
    descripcion:
      'Bordeadora eléctrica con hilo de nylon recargable. Para bordes de jardín prolijos.',
    imageUrl: IMAGENES.bordeadora,
  },
  {
    title: 'Cortadora de césped a batería',
    slug: 'cortadora-bateria',
    ownerEmail: 'herramientas@benteveo-demo.com',
    category: 'Jardinería',
    priceDay: 3000,
    priceMonth: 96000,
    deposit: 200,
    zone: 'CABA',
    city: 'Caballito',
    state: 'CABA',
    address: 'Av. Rivadavia 5400',
    descripcion:
      'Cortadora de césped a batería, silenciosa y sin cables. Perfecta para patios medianos.',
    imageUrl: IMAGENES.cortadora,
  },

  // Owner: camping
  {
    title: 'Carpa impermeable 4 plazas',
    slug: 'carpa-impermeable',
    ownerEmail: 'camping@benteveo-demo.com',
    category: 'Aire libre',
    priceDay: 500,
    priceMonth: 66000,
    deposit: 100,
    zone: 'Zona Norte',
    city: 'Tigre',
    state: 'Buenos Aires',
    address: 'Ruta 8 km 45',
    descripcion:
      'Carpa impermeable para 4 plazas con piso reforzado. Incluye bolsa de transporte.',
    imageUrl: IMAGENES.carpa,
  },
  {
    title: 'Conservadora eléctrica 12V',
    slug: 'conservadora-electrica',
    ownerEmail: 'camping@benteveo-demo.com',
    category: 'Aire libre',
    priceDay: 400,
    priceMonth: 48000,
    deposit: 100,
    zone: 'Zona Norte',
    city: 'Tigre',
    state: 'Buenos Aires',
    address: 'Ruta 8 km 45',
    descripcion:
      'Conservadora eléctrica 12/220V. Mantiene frío por horas. Ideal para viajes y eventos.',
    imageUrl: IMAGENES.conservadora,
  },
  {
    title: 'Metegol de madera profesional',
    slug: 'metegol-madera',
    ownerEmail: 'camping@benteveo-demo.com',
    category: 'Cumpleaños y celebraciones',
    priceDay: 150,
    priceMonth: 180000,
    deposit: 500,
    zone: 'Zona Norte',
    city: 'Tigre',
    state: 'Buenos Aires',
    address: 'Ruta 8 km 45',
    descripcion:
      'Metegol profesional de madera con bolas incluidas. Ideal para cumpleaños y eventos.',
    imageUrl: IMAGENES.metegol,
  },
  {
    title: 'Cama elástica con red de seguridad',
    slug: 'cama-elastica-red',
    ownerEmail: 'camping@benteveo-demo.com',
    category: 'Cumpleaños y celebraciones',
    priceDay: 100,
    priceMonth: 144000,
    deposit: 400,
    zone: 'Zona Norte',
    city: 'Tigre',
    state: 'Buenos Aires',
    address: 'Ruta 8 km 45',
    descripcion:
      'Cama elástica con red de protección e inflador incluido. Para niños y fiestas.',
    imageUrl: IMAGENES.camaElastica,
  },

  // Owner: fotografia
  {
    title: 'Aspiradora industrial HEPA',
    slug: 'aspiradora-hepa',
    ownerEmail: 'fotografia@benteveo-demo.com',
    category: 'Electrodomésticos',
    priceDay: 300,
    priceMonth: 45600,
    deposit: 100,
    zone: 'CABA',
    city: 'Palermo',
    state: 'CABA',
    address: 'Av. Santa Fe 3400',
    descripcion:
      'Aspiradora industrial con filtro HEPA. Ideal para limpieza profunda de tapizados y pisos.',
    imageUrl: IMAGENES.aspiradora,
  },
  {
    title: 'Máquina de coser eléctrica',
    slug: 'maquina-coser-electrica',
    ownerEmail: 'fotografia@benteveo-demo.com',
    category: 'Electrodomésticos',
    priceDay: 5000,
    priceMonth: 60000,
    deposit: 100,
    zone: 'CABA',
    city: 'Palermo',
    state: 'CABA',
    address: 'Av. Santa Fe 3400',
    descripcion:
      'Máquina de coser eléctrica con 12 puntadas. Perfecta para arreglos y proyectos textiles.',
    imageUrl: IMAGENES.maquinaCoser,
  },
  {
    title: 'Cámara DSLR con lente 18-55',
    slug: 'camara-dslr',
    ownerEmail: 'fotografia@benteveo-demo.com',
    category: 'Fotografía',
    priceDay: 9000,
    priceMonth: 108000,
    deposit: 300,
    zone: 'CABA',
    city: 'Palermo',
    state: 'CABA',
    address: 'Av. Santa Fe 3400',
    descripcion:
      'Cámara DSLR con lente 18-55mm. Incluye memoria 64GB, funda y cargador de repuesto.',
    imageUrl: IMAGENES.camara,
  },
  {
    title: 'Drone con cámara 4K',
    slug: 'dron-4k',
    ownerEmail: 'fotografia@benteveo-demo.com',
    category: 'Fotografía',
    priceDay: 20000,
    priceMonth: 240000,
    deposit: 600,
    zone: 'CABA',
    city: 'Palermo',
    state: 'CABA',
    address: 'Av. Santa Fe 3400',
    descripcion:
      'Drone con cámara 4K y estabilizador de 3 ejes. 2 baterías de vuelo incluidas.',
    imageUrl: IMAGENES.drone,
  },
  {
    title: 'Pack raquetas de pádel',
    slug: 'raquetas-padel',
    ownerEmail: 'fotografia@benteveo-demo.com',
    category: 'Deportes',
    priceDay: 3200,
    priceMonth: 38400,
    deposit: 80,
    zone: 'CABA',
    city: 'Palermo',
    state: 'CABA',
    address: 'Av. Santa Fe 3400',
    descripcion:
      'Pack de 2 raquetas de pádel con fundas y overgrips. Uso intermedio/avanzado.',
    imageUrl: IMAGENES.raqueta,
  },
];

// ─── RESERVAS (6: los 5 estados + una COMPLETED extra para UserRating) ─
const RESERVATIONS = [
  {
    key: 'pend-taladro',
    productTitle: 'Taladro inalámbrico 18V',
    renterEmail: 'juan@benteveo-demo.com',
    dateInit: '2026-10-15',
    dateEnd: '2026-10-17',
    status: 'PENDING',
    totalAmount: 9000,
  },
  {
    key: 'conf-carpa',
    productTitle: 'Carpa impermeable 4 plazas',
    renterEmail: 'maria@benteveo-demo.com',
    dateInit: '2026-10-20',
    dateEnd: '2026-10-22',
    status: 'CONFIRMED',
    totalAmount: 11000,
    paymentReceivedAt: '2026-10-02',
  },
  {
    key: 'act-camara',
    productTitle: 'Cámara DSLR con lente 18-55',
    renterEmail: 'pedro@benteveo-demo.com',
    dateInit: '2026-10-01',
    dateEnd: '2026-10-06',
    status: 'ACTIVE',
    totalAmount: 45000,
    paymentReceivedAt: '2026-09-30',
    actualHandoffAt: '2026-10-01T10:00:00',
    renterReceivedAt: '2026-10-01T10:30:00',
    handoffNotes: 'Entrega en Palermo, todo en orden.',
  },
  {
    key: 'comp-metegol',
    productTitle: 'Metegol de madera profesional',
    renterEmail: 'juan@benteveo-demo.com',
    dateInit: '2026-08-20',
    dateEnd: '2026-08-22',
    status: 'COMPLETED',
    totalAmount: 30000,
    paymentReceivedAt: '2026-08-19',
    actualHandoffAt: '2026-08-20T16:00:00',
    renterReceivedAt: '2026-08-20T16:30:00',
    renterReturnedAt: '2026-08-22T18:00:00',
    actualReturnAt: '2026-08-22T18:00:00',
    handoffNotes: 'Devolución en perfectas condiciones.',
  },
  {
    key: 'canc-drone',
    productTitle: 'Drone con cámara 4K',
    renterEmail: 'maria@benteveo-demo.com',
    dateInit: '2026-08-10',
    dateEnd: '2026-08-12',
    status: 'CANCELLED',
    totalAmount: 40000,
  },
  {
    key: 'comp-cama',
    productTitle: 'Cama elástica con red de seguridad',
    renterEmail: 'pedro@benteveo-demo.com',
    dateInit: '2026-09-01',
    dateEnd: '2026-09-03',
    status: 'COMPLETED',
    totalAmount: 24000,
    paymentReceivedAt: '2026-08-30',
    actualHandoffAt: '2026-09-01T09:00:00',
    renterReceivedAt: '2026-09-01T09:15:00',
    renterReturnedAt: '2026-09-03T17:00:00',
    actualReturnAt: '2026-09-03T17:00:00',
  },
];

// ─── FAVORITOS ──────────────────────────────────────────────────────────
const FAVORITES = [
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Taladro inalámbrico 18V' },
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Metegol de madera profesional' },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Carpa impermeable 4 plazas' },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Cama elástica con red de seguridad' },
  { userEmail: 'pedro@benteveo-demo.com', productTitle: 'Cámara DSLR con lente 18-55' },
  { userEmail: 'pedro@benteveo-demo.com', productTitle: 'Drone con cámara 4K' },
];

// ─── COMENTARIOS ────────────────────────────────────────────────────────
const COMMENTS = [
  {
    userEmail: 'juan@benteveo-demo.com',
    productTitle: 'Taladro inalámbrico 18V',
    text: 'Excelente taladro, muy potente. Lo usé para varios arreglos en casa.',
  },
  {
    userEmail: 'maria@benteveo-demo.com',
    productTitle: 'Carpa impermeable 4 plazas',
    text: 'Carpa cómoda e impermeable. Pasamos un fin de semana genial.',
  },
  {
    userEmail: 'pedro@benteveo-demo.com',
    productTitle: 'Cámara DSLR con lente 18-55',
    text: 'Cámara en perfecto estado. Las fotos salieron increíbles.',
  },
  {
    userEmail: 'juan@benteveo-demo.com',
    productTitle: 'Metegol de madera profesional',
    text: 'El metegol estuvo bárbaro en la fiesta. Todos se divirtieron.',
  },
];

// ─── RATINGS DE PRODUCTO (máx 1 por usuario+producto, sin auto-rating) ─
const RATINGS = [
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Taladro inalámbrico 18V', score: 5 },
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Metegol de madera profesional', score: 5 },
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Conservadora eléctrica 12V', score: 4 },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Carpa impermeable 4 plazas', score: 4 },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Cama elástica con red de seguridad', score: 5 },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Aspiradora industrial HEPA', score: 5 },
  { userEmail: 'pedro@benteveo-demo.com', productTitle: 'Cámara DSLR con lente 18-55', score: 5 },
  { userEmail: 'pedro@benteveo-demo.com', productTitle: 'Escalera plegable 5 metros', score: 4 },
  // — Productos de propietaria@benteveo.com (nadie califica lo suyo) —
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Carpa 4 personas', score: 4 },
  { userEmail: 'pedro@benteveo-demo.com', productTitle: 'Gazebo plegable 3x3', score: 5 },
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Castillo inflable', score: 4 },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Máquina de pochoclos', score: 3 },
  { userEmail: 'pedro@benteveo-demo.com', productTitle: 'Aspiradora multiuso', score: 4 },
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Conservadora portátil', score: 5 },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Proyector Full HD', score: 5 },
  { userEmail: 'pedro@benteveo-demo.com', productTitle: 'Parlante Bluetooth 100W', score: 3 },
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Taladro percutor 800W', score: 4 },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Soldadora inverter 200A', score: 4 },
  { userEmail: 'pedro@benteveo-demo.com', productTitle: 'Bordeadora eléctrica', score: 5 },
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Desmalezadora a explosión', score: 3 },
  { userEmail: 'maria@benteveo-demo.com', productTitle: 'Mesa de luz nórdica', score: 5 },
  { userEmail: 'juan@benteveo-demo.com', productTitle: 'Sillón de lectura', score: 5 },
];

// ─── USER RATINGS (solo reservas COMPLETED, bilateral) ─────────────────
const USER_RATINGS = [
  // Reserva comp-metegol: juan (inquilino) ↔ camping (dueña)
  { reservationKey: 'comp-metegol', raterEmail: 'juan@benteveo-demo.com', ratedEmail: 'camping@benteveo-demo.com', score: 5 },
  { reservationKey: 'comp-metegol', raterEmail: 'camping@benteveo-demo.com', ratedEmail: 'juan@benteveo-demo.com', score: 4 },
  // Reserva comp-cama: pedro (inquilino) ↔ camping (dueña)
  { reservationKey: 'comp-cama', raterEmail: 'pedro@benteveo-demo.com', ratedEmail: 'camping@benteveo-demo.com', score: 5 },
  { reservationKey: 'comp-cama', raterEmail: 'camping@benteveo-demo.com', ratedEmail: 'pedro@benteveo-demo.com', score: 5 },
];

// ─── MAIN ───────────────────────────────────────────────────────────────
async function main() {
  // Safety check: only run against localhost unless SEED_ALLOW_REMOTE=1
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no está definida.');
    process.exit(1);
  }
  const host = new URL(dbUrl).hostname;
  console.log(`DB host: ${host}`);
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (!isLocal && process.env.SEED_ALLOW_REMOTE !== '1') {
    console.error(`❌ Host remoto detectado (${host}). Aborta. Usa SEED_ALLOW_REMOTE=1 para forzar.`);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const log = {
    usersCreated: 0,
    usersExisting: 0,
    productsCreated: 0,
    productsExisting: 0,
    photosCreated: 0,
    reservationsCreated: 0,
    reservationsExisting: 0,
    favoritesCreated: 0,
    favoritesExisting: 0,
    commentsCreated: 0,
    commentsExisting: 0,
    ratingsCreated: 0,
    ratingsExisting: 0,
    ratingsTitlesMissing: [] as string[],
    userRatingsCreated: 0,
    userRatingsExisting: 0,
    productsRatingUpdated: 0,
    galleriesProductsUpdated: 0,
    galleriesPhotosCreated: 0,
    galleriesTitlesMissing: [] as string[],
    galleriesTitlesSkipped: [] as string[],
  };

  try {
    // ── 1. Usuarios ────────────────────────────────────────────────────
    const emailToId = new Map<string, string>();
    const hashedPassword = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    for (const u of USERS) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        emailToId.set(u.email, existing.id);
        log.usersExisting++;
      } else {
        const user = await prisma.user.create({
          data: {
            name: u.name,
            email: u.email,
            password: hashedPassword,
            dni: u.dni,
            isIdentityVerified: true,
            role: 'USER',
            profile: { create: { phone: u.phone, description: u.profileDesc } },
          },
        });
        emailToId.set(u.email, user.id);
        log.usersCreated++;
      }
    }

    // ── 2. Productos ───────────────────────────────────────────────────
    const titleToId = new Map<string, string>();

    for (const p of PRODUCTS) {
      const ownerId = emailToId.get(p.ownerEmail);
      if (!ownerId) {
        console.warn(`⚠ Owner no encontrado: ${p.ownerEmail}`);
        continue;
      }

      const existing = await prisma.product.findFirst({ where: { title: p.title } });
      if (existing) {
        titleToId.set(p.title, existing.id);
        log.productsExisting++;
      } else {
        const product = await prisma.product.create({
          data: {
            title: p.title,
            descripcion: p.descripcion,
            priceDay: p.priceDay,
            priceMonth: p.priceMonth,
            deposit: p.deposit,
         zone: p.zone,
            city: p.city,
            state: p.state,
            address: p.address,
            category: p.category,
            ownerId,
            isAvailable: true,
          },
        });
        titleToId.set(p.title, product.id);
        log.productsCreated++;
      }
    }

    // ── 3. PhotoProduct ────────────────────────────────────────────────
    for (const p of PRODUCTS) {
      const productId = titleToId.get(p.title);
      if (!productId) continue;

      const photoCount = await prisma.photoProduct.count({ where: { productId } });
      if (photoCount === 0) {
        await prisma.photoProduct.create({
          data: { productId, url: p.imageUrl, publicId: `seed-demo/${p.slug}` },
        });
        log.photosCreated++;
      }
    }

    // ── 3b. Galerías (fotos reales de productos) ────────────────────────
    // Regla: solo reemplaza si el producto no tiene fotos o si TODAS sus
    // fotos actuales son placeholders (picsum.photos / placehold.co).
    // Si alguna foto es de Cloudinary o local (/images/...), no se toca.
    const isPlaceholderUrl = (url: string) =>
      url.includes('picsum.photos') || url.includes('placehold.co');

    for (const [title, urls] of Object.entries(GALERIAS)) {
      const product = await prisma.product.findFirst({ where: { title } });
      if (!product) {
        log.galleriesTitlesMissing.push(title);
        continue;
      }

      const photos = await prisma.photoProduct.findMany({
        where: { productId: product.id },
      });
      const canReplace =
        photos.length === 0 || photos.every((ph) => isPlaceholderUrl(ph.url));

      if (!canReplace) {
        log.galleriesTitlesSkipped.push(title);
        continue;
      }

      if (photos.length > 0) {
        await prisma.photoProduct.deleteMany({ where: { productId: product.id } });
      }

      const def = PRODUCTS.find((p) => p.title === title);
      const slug = def ? def.slug : slugify(title);

      for (let i = 0; i < urls.length; i++) {
        await prisma.photoProduct.create({
          data: {
            productId: product.id,
            url: urls[i],
            publicId: `seed-demo/${slug}-${i + 1}`,
          },
        });
        log.galleriesPhotosCreated++;
      }
      log.galleriesProductsUpdated++;
    }

    // ── 4. Reservas ────────────────────────────────────────────────────
    const keyToReservationId = new Map<string, string>();

    for (const r of RESERVATIONS) {
      const productId = titleToId.get(r.productTitle);
      const userId = emailToId.get(r.renterEmail);
      if (!productId || !userId) {
        console.warn(`⚠ Reserva ${r.key}: datos faltantes`);
        continue;
      }

      const dateInit = new Date(r.dateInit);
      const existing = await prisma.reservation.findFirst({
        where: { productId, userId, dateInit },
      });

      if (existing) {
        keyToReservationId.set(r.key, existing.id);
        log.reservationsExisting++;
      } else {
        const data: Record<string, unknown> = {
          dateInit,
          dateEnd: new Date(r.dateEnd),
          status: r.status,
          totalAmount: r.totalAmount,
          productId,
          userId,
        };
        if (r.paymentReceivedAt) data.paymentReceivedAt = new Date(r.paymentReceivedAt);
        if (r.actualHandoffAt) data.actualHandoffAt = new Date(r.actualHandoffAt);
        if (r.renterReceivedAt) data.renterReceivedAt = new Date(r.renterReceivedAt);
        if (r.renterReturnedAt) data.renterReturnedAt = new Date(r.renterReturnedAt);
        if (r.actualReturnAt) data.actualReturnAt = new Date(r.actualReturnAt);
        if (r.handoffNotes) data.handoffNotes = r.handoffNotes;

        const reservation = await prisma.reservation.create({ data } as any);
        keyToReservationId.set(r.key, reservation.id);
        log.reservationsCreated++;
      }
    }

    // ── 5. Favoritos ───────────────────────────────────────────────────
    for (const f of FAVORITES) {
      const userId = emailToId.get(f.userEmail);
      const productId = titleToId.get(f.productTitle);
      if (!userId || !productId) continue;

      const existing = await prisma.favorite.findUnique({
        where: { userId_productId: { userId, productId } },
      });
      if (existing) {
        log.favoritesExisting++;
      } else {
        await prisma.favorite.create({ data: { userId, productId } });
        log.favoritesCreated++;
      }
    }

    // ── 6. Comentarios ─────────────────────────────────────────────────
    for (const c of COMMENTS) {
      const userId = emailToId.get(c.userEmail);
      const productId = titleToId.get(c.productTitle);
      if (!userId || !productId) continue;

      const existing = await prisma.comment.findFirst({
        where: { userId, productId, text: c.text },
      });
      if (existing) {
        log.commentsExisting++;
      } else {
        await prisma.comment.create({ data: { text: c.text, userId, productId } });
        log.commentsCreated++;
      }
    }

    // ── 7. Ratings de producto ─────────────────────────────────────────
    for (const r of RATINGS) {
      const userId = emailToId.get(r.userEmail);

      // titleToId solo conoce los títulos de PRODUCTS; si el rating apunta a
      // un producto de otra fuente, se resuelve contra la BD.
      let productId = titleToId.get(r.productTitle);
      if (!productId) {
        const found = await prisma.product.findFirst({
          where: { title: r.productTitle, isDeleted: false },
        });
        if (found) {
          productId = found.id;
          titleToId.set(r.productTitle, found.id);
        }
      }

      if (!userId) {
        console.warn(`⚠ Rating ${r.userEmail} -> ${r.productTitle}: usuario no encontrado`);
        continue;
      }
      if (!productId) {
        if (!log.ratingsTitlesMissing.includes(r.productTitle)) {
          log.ratingsTitlesMissing.push(r.productTitle);
        }
        continue;
      }

      const existing = await prisma.rating.findUnique({
        where: { userId_productId: { userId, productId } },
      });
      if (existing) {
        log.ratingsExisting++;
      } else {
        await prisma.rating.create({ data: { score: r.score, userId, productId } });
        log.ratingsCreated++;
      }
    }

    // ── 8. UserRatings (solo reservas COMPLETED) ───────────────────────
    for (const ur of USER_RATINGS) {
      const reservationId = keyToReservationId.get(ur.reservationKey);
      const raterId = emailToId.get(ur.raterEmail);
      const ratedUserId = emailToId.get(ur.ratedEmail);
      if (!reservationId || !raterId || !ratedUserId) {
        console.warn(`⚠ UserRating ${ur.reservationKey}: datos faltantes`);
        continue;
      }

      const existing = await prisma.userRating.findUnique({
        where: { reservationId_raterId: { reservationId, raterId } },
      });
      if (existing) {
        log.userRatingsExisting++;
      } else {
        await prisma.userRating.create({
          data: { score: ur.score, reservationId, raterId, ratedUserId },
        });
        log.userRatingsCreated++;
      }
    }

    // ── 9. Calcular rating promedio y reviewCount en Product ───────────
    const allRatings = await prisma.rating.findMany({ select: { productId: true, score: true } });
    const byProduct = new Map<string, number[]>();
    for (const r of allRatings) {
      const arr = byProduct.get(r.productId) ?? [];
      arr.push(r.score);
      byProduct.set(r.productId, arr);
    }

    for (const [productId, scores] of byProduct) {
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      await prisma.product.update({
        where: { id: productId },
        data: { rating: avg, reviewCount: scores.length },
      });
      log.productsRatingUpdated++;
    }

    // ── Resumen ────────────────────────────────────────────────────────
    console.log('\n── Resumen seed-demo ──');
    console.log(`Usuarios:        ${log.usersCreated} creados, ${log.usersExisting} existentes`);
    console.log(`Productos:       ${log.productsCreated} creados, ${log.productsExisting} existentes`);
    console.log(`Fotos:           ${log.photosCreated} creadas`);
    console.log(`Galerías:        ${log.galleriesProductsUpdated} productos actualizados, ${log.galleriesPhotosCreated} fotos creadas`);
    if (log.galleriesTitlesSkipped.length > 0) {
      console.log(`  salteadas (fotos reales, no se tocaron): ${log.galleriesTitlesSkipped.join(' | ')}`);
    }
    if (log.galleriesTitlesMissing.length > 0) {
      console.log(`  títulos no encontrados: ${log.galleriesTitlesMissing.join(' | ')}`);
    }
    console.log(`Reservas:        ${log.reservationsCreated} creadas, ${log.reservationsExisting} existentes`);
    console.log(`Favoritos:       ${log.favoritesCreated} creados, ${log.favoritesExisting} existentes`);
    console.log(`Comentarios:     ${log.commentsCreated} creados, ${log.commentsExisting} existentes`);
    console.log(`Ratings prod.:   ${log.ratingsCreated} creados, ${log.ratingsExisting} existentes`);
    if (log.ratingsTitlesMissing.length > 0) {
      console.log(`  Ratings: títulos no encontrados: ${log.ratingsTitlesMissing.join(' | ')}`);
    }
    console.log(`UserRatings:     ${log.userRatingsCreated} creados, ${log.userRatingsExisting} existentes`);
    console.log(`Products upd.:   ${log.productsRatingUpdated} con rating recalculado`);
    console.log('────────────────────────\n');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
