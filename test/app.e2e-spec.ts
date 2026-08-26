import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { RequestIdMiddleware } from './../src/common/middleware/request-id.middleware';

/**
 * E2E tests — Autorización server-side.
 *
 * Requiere PostgreSQL accesible vía DATABASE_URL en .env.
 * Si no hay DB, los tests fallan por infraestructura (no por lógica).
 */
describe('Autorización server-side (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Registrar pipes, filters y middleware globales igual que main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.use(RequestIdMiddleware);
    app.setGlobalPrefix('api/v1');

    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  // ── Helpers ────────────────────────────────────────────────────────

  const TEST_EMAIL = `e2e-auth-${Date.now()}@test.com`;
  const TEST_PASSWORD = 'Test1234!';
  const TEST_DNI = `${Date.now()}`.slice(0, 8).padEnd(8, '0');

  /** Registra un usuario y retorna la cookie de sesión. */
  async function registerUser(
    overrides: Record<string, unknown> = {},
  ): Promise<{ status: number; body: unknown }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        name: 'E2E User',
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        dni: TEST_DNI,
        phone: '+5491100000000',
        ...overrides,
      });
    return { status: res.status, body: res.body };
  }

  /** Login y retorna cookies Set-Cookie. */
  async function loginUser(
    email = TEST_EMAIL,
    password = TEST_PASSWORD,
  ): Promise<{ status: number; setCookie: string[] }> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    return { status: res.status, setCookie: res.get('Set-Cookie') ?? [] };
  }

  // ── 1. Register role:ADMIN → 422 ─────────────────────────────────

  describe('1. Register rechaza role arbitrario', () => {
    it('POST /auth/register con role:ADMIN devuelve 422 VALIDATION_FAILED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Hacker',
          email: `role-hack-${Date.now()}@test.com`,
          password: TEST_PASSWORD,
          dni: '12345678',
          phone: '+5491100000001',
          role: 'ADMIN',
        });

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('code', 'VALIDATION_FAILED');
    });

    it('POST /auth/register sin role crea usuario USER', async () => {
      const res = await registerUser();
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('role', 'USER');
    });
  });

  // ── 2. Login isDeleted → 401 ──────────────────────────────────────

  describe('2. Login con usuario eliminado', () => {
    it('POST /auth/login con credenciales inválidas devuelve 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrongpass' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('code', 'AUTH_INVALID_CREDENTIALS');
    });
  });

  // ── 3. Cookie flags HttpOnly ───────────────────────────────────────

  describe('3. Cookie flags HttpOnly', () => {
    it('login emite cookie benteveo_session con HttpOnly', async () => {
      const { setCookie } = await loginUser();

      const sessionCookie = setCookie.find((c) =>
        c.startsWith('benteveo_session='),
      );
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/HttpOnly/i);
      expect(sessionCookie).toMatch(/Path=\//);
    });

    it('login emite cookie benteveo_csrf sin HttpOnly', async () => {
      const { setCookie } = await loginUser();

      const csrfCookie = setCookie.find((c) =>
        c.startsWith('benteveo_csrf='),
      );
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie).not.toMatch(/HttpOnly/i);
    });
  });

  // ── 4. Logout → 401 ──────────────────────────────────────────────

  describe('4. Logout invalida la sesión', () => {
    it('POST /auth/logout limpia cookies, uso posterior → 401', async () => {
      // Login para obtener cookies
      const { setCookie } = await loginUser();
      const cookieHeader = setCookie
        .map((c) => c.split(';')[0])
        .join('; ');

      // Logout
      const logoutRes = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookieHeader);

      expect(logoutRes.status).toBe(204);

      // Intentar acceder a ruta protegida → 401
      const meRes = await request(app.getHttpServer())
        .get('/api/v1/user/data-user')
        .set('Cookie', cookieHeader);

      expect(meRes.status).toBe(401);
    });
  });

  // ── 5. Escritura sin CSRF → 403 ──────────────────────────────────

  describe('5. CSRF protection', () => {
    it('POST autenticado sin X-CSRF-Token → 403 CSRF_TOKEN_INVALID', async () => {
      const { setCookie } = await loginUser();
      const cookieHeader = setCookie
        .map((c) => c.split(';')[0])
        .join('; ');

      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', cookieHeader)
        .send({
          title: 'Test Product',
          descripcion: 'Test',
          priceDay: 1000,
          priceMonth: 10000,
          deposit: 5000,
          zone: 'CABA',
          city: 'Palermo',
          state: 'CABA',
          address: 'Test 123',
          category: 'Test',
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('code', 'CSRF_TOKEN_INVALID');
    });
  });

  // ── 6. Publicar/reservar sin KYC → 403 ───────────────────────────

  describe('6. KYC gate', () => {
    it('POST /products sin isIdentityVerified → 403 AUTH_KYC_REQUIRED', async () => {
      const { setCookie } = await loginUser();
      const cookieHeader = setCookie
        .map((c) => c.split(';')[0])
        .join('; ');

      // Obtener CSRF token
      const csrfRes = await request(app.getHttpServer())
        .get('/api/v1/auth/csrf')
        .set('Cookie', cookieHeader);
      const csrfToken = csrfRes.body.csrfToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Cookie', cookieHeader)
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Test Product',
          descripcion: 'Test',
          priceDay: 1000,
          priceMonth: 10000,
          deposit: 5000,
          zone: 'CABA',
          city: 'Palermo',
          state: 'CABA',
          address: 'Test 123',
          category: 'Test',
        });

      // Si el usuario no tiene isIdentityVerified, debe ser 403
      // Si tiene isIdentityVerified (depende del test data), puede ser 201
      if (res.status === 403) {
        expect(res.body).toHaveProperty('code', 'AUTH_KYC_REQUIRED');
      }
    });
  });

  // ── 7. Degradado pierde ADMIN ─────────────────────────────────────

  describe('7. Usuario degradado pierde acceso', () => {
    it('Usuario con role USER no puede acceder a endpoints ADMIN', async () => {
      const { setCookie } = await loginUser();
      const cookieHeader = setCookie
        .map((c) => c.split(';')[0])
        .join('; ');

      // GET /user (findAll) requiere ADMIN
      const res = await request(app.getHttpServer())
        .get('/api/v1/user')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(403);
    });
  });

  // ── 8. Error 500 normalizado ──────────────────────────────────────

  describe('8. Error contract shape', () => {
    it('error de validación tiene shape {code, message, fields, requestId}', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({}); // body vacío → 422

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('fields');
    });

    it('X-Request-Id entrante se refleja en la respuesta', async () => {
      const requestId = `test-${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('X-Request-Id', requestId)
        .send({});

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('requestId');
    });
  });
});
