import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';

const GENERIC_MESSAGE =
  'If the email is not already registered, a confirmation has been sent.';

/**
 * Returns a unique email per test invocation so parallel runs and
 * repeated runs don't collide on the @unique constraint.
 */
function uniqueEmail(): string {
  return `register-e2e-${randomUUID()}@finpilot.test`;
}

const VALID_PASSWORD = 'Password1!';

describe('AuthController — POST /api/v1/auth/register (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror the production bootstrap from main.ts so behavior under test
    // matches what the API will actually do in real environments.
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

  it('returns 201 with the generic message on a successful registration', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail(),
        password: VALID_PASSWORD,
        firstName: 'Harshit',
        lastName: 'Dave',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual({ message: GENERIC_MESSAGE });
      });
  });

  it('returns the same response when the email is already registered (no enumeration leak)', async () => {
    const email = uniqueEmail();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201)
      .expect({ message: GENERIC_MESSAGE });

    // Second request with the same email must produce an IDENTICAL body,
    // not a 409. This is the core anti-enumeration guarantee.
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: VALID_PASSWORD })
      .expect(201)
      .expect({ message: GENERIC_MESSAGE });
  });

  it('rejects a password without an uppercase letter (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail(), password: 'password1!' })
      .expect(400);
  });

  it('rejects a password without a digit (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail(), password: 'Password!!' })
      .expect(400);
  });

  it('rejects a password shorter than 8 characters (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail(), password: 'Pa1!' })
      .expect(400);
  });

  it('rejects a malformed email (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: VALID_PASSWORD })
      .expect(400);
  });

  it('treats emails with surrounding whitespace as identical (trims before lookup)', async () => {
    const base = uniqueEmail();
    const padded = `   ${base}   `;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: padded, password: VALID_PASSWORD })
      .expect(201)
      .expect({ message: GENERIC_MESSAGE });

    // A second register with the trimmed email must NOT produce a fresh user —
    // it must hit the duplicate path and return the same generic body.
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: base, password: VALID_PASSWORD })
      .expect(201)
      .expect({ message: GENERIC_MESSAGE });
  });

  it('treats emails with different casing as identical (lowercases before lookup)', async () => {
    const lower = uniqueEmail();
    const upper = lower.toUpperCase();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: upper, password: VALID_PASSWORD })
      .expect(201)
      .expect({ message: GENERIC_MESSAGE });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: lower, password: VALID_PASSWORD })
      .expect(201)
      .expect({ message: GENERIC_MESSAGE });
  });

  it('rejects unknown fields (forbidNonWhitelisted)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail(),
        password: VALID_PASSWORD,
        isAdmin: true,
      })
      .expect(400);
  });

  it('rejects a missing password (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail() })
      .expect(400);
  });

  it('rejects firstName with disallowed characters (400)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: uniqueEmail(),
        password: VALID_PASSWORD,
        firstName: '<script>',
      })
      .expect(400);
  });
});
