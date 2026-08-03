import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror the production bootstrap from main.ts so the test exercises
    // the same routing surface as the real API.
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/auth/health returns 200 with the health payload', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/health')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'healthy',
      }),
    );
  });
});
