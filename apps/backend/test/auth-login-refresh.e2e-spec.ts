import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createInMemoryPrisma } from './support/in-memory-prisma';

const VALID_PASSWORD = 'Password1!';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function uniqueEmail(): string {
  return `login-refresh-e2e-${randomUUID()}@finpilot.test`;
}

async function login(
  app: INestApplication<App>,
  email: string,
  password = VALID_PASSWORD,
): Promise<TokenPair> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(201);

  return res.body as TokenPair;
}

async function registerAndLogin(
  app: INestApplication<App>,
  email: string,
): Promise<TokenPair> {
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password: VALID_PASSWORD })
    .expect(201);

  return login(app, email);
}

describe('AuthController — login/refresh/logout (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Never write to the real database in tests — swap PrismaService for
      // an in-memory double so this suite still exercises the full HTTP
      // stack (guards, validation, throttling) via supertest without
      // touching Postgres.
      .overrideProvider(PrismaService)
      .useValue(createInMemoryPrisma())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in a freshly registered (unverified) user without blocking on verification', async () => {
    const tokens = await registerAndLogin(app, uniqueEmail());

    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toEqual(expect.any(String));
  });

  it('rejects login with the wrong password (401)', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword1!' })
      .expect(401);
  });

  it('refresh rotates the token pair and detects reuse of the original token, killing the whole family', async () => {
    const email = uniqueEmail();
    const { refreshToken: original } = await registerAndLogin(app, email);

    const rotateRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: original })
      .expect(201);

    const { refreshToken: rotated } = rotateRes.body as TokenPair;
    expect(rotated).toEqual(expect.any(String));
    expect(rotated).not.toBe(original);

    // Presenting the original (already-rotated-away) token again is reuse —
    // the whole rotation family must be killed as a result.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: original })
      .expect(401);

    // The token that reuse detection was supposed to protect (the one
    // produced by the legitimate rotation) must now be dead too, since the
    // entire family was revoked, not just the reused row.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: rotated })
      .expect(401);
  });

  it('rejects a refresh with a syntactically invalid token (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'not-a-real-jwt' })
      .expect(401);
  });

  it('/me returns the authenticated user while the access token is valid', async () => {
    const email = uniqueEmail();
    const { accessToken } = await registerAndLogin(app, email);

    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as { user: { email: string } };
    expect(body.user.email).toBe(email);
  });

  it('/me rejects a missing or malformed access token (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('logout revokes only the session matching the presented refresh token, other sessions for the same user stay alive', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    // Two independent logins produce two independent session families.
    const sessionA = await login(app, email);
    const sessionB = await login(app, email);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${sessionA.accessToken}`)
      .expect(201);

    // Session A's refresh token is now dead.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: sessionA.refreshToken })
      .expect(401);

    // Session B is untouched by session A's logout.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: sessionB.refreshToken })
      .expect(201);
  });

  it('throttles rapid failed logins for the same email while leaving a different email unaffected', async () => {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201);

    for (let i = 0; i < 4; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword1!' })
        .expect(401);
    }

    // The next attempt against the same email should now be throttled.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword1!' })
      .expect(429);

    // A login attempt for a different email is unaffected — the counter is
    // keyed per-email, not global.
    const otherEmail = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: otherEmail, password: VALID_PASSWORD })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherEmail, password: VALID_PASSWORD })
      .expect(201);
  });
});
