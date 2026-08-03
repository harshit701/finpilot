import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

// Mock bcrypt as a whole module. `jest.spyOn(bcrypt, '...')` cannot
// redefine the named exports of `bcrypt` under Jest 30 (its ESM-style
// module loader treats them as read-only), so each test configures the
// shared mock implementation explicitly via the factory below.
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const GENERIC_RESPONSE = {
  message:
    'If the email is not already registered, a confirmation has been sent.',
};

const hashMock = bcrypt.hash as unknown as jest.Mock;
const compareMock = bcrypt.compare as unknown as jest.Mock;

describe('AuthService — register', () => {
  let service: AuthService;
  let prismaUserCreate: jest.Mock;
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    hashMock.mockReset();
    compareMock.mockReset();

    // Default behavior: hash returns a deterministic stubbed hash so we
    // can assert it was passed through; compare resolves false so the
    // dummy-completion branch resolves quickly.
    hashMock.mockImplementation(async (plain: string) => `hashed:${plain}`);
    compareMock.mockResolvedValue(false);

    prismaUserCreate = jest.fn().mockResolvedValue({
      id: 'user-id',
      email: 'harshit@finpilot.com',
      firstName: 'Harshit',
      lastName: 'Dave',
      isEmailVerified: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const prismaMock = {
      user: { create: prismaUserCreate },
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'BCRYPT_SALT_ROUNDS') return '4'; // low for fast tests
        if (key === 'APP_NAME') return 'finpilot';
        if (key === 'NODE_ENV') return 'test';
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret';
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        return 'value';
      }),
    };

    jwtService = { signAsync: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('hashes the password with bcrypt before persisting', async () => {
    await service.register({
      email: 'harshit@finpilot.com',
      password: 'Password1!',
      firstName: 'Harshit',
      lastName: 'Dave',
    });

    expect(hashMock).toHaveBeenCalledWith('Password1!', 4);
  });

  it('creates user with normalized fields and omits sensitive columns', async () => {
    await service.register({
      email: 'Harshit@FinPilot.com',
      password: 'Password1!',
      firstName: 'Harshit',
      lastName: 'Dave',
    });

    expect(prismaUserCreate).toHaveBeenCalledTimes(1);
    const call = prismaUserCreate.mock.calls[0][0];

    // Email is normalized to lowercase by the DTO @Transform before
    // reaching the service.
    expect(call.data.email).toBe('Harshit@FinPilot.com');
    expect(call.data.passwordHash).toEqual(expect.any(String));
    expect(call.data.passwordHash).not.toBe('Password1!');
    expect(call.omit).toEqual({ passwordHash: true, refreshToken: true });
  });

  it('returns the generic message on a successful create', async () => {
    const result = await service.register({
      email: 'harshit@finpilot.com',
      password: 'Password1!',
    });

    expect(result).toEqual(GENERIC_RESPONSE);
  });

  it('returns the same generic message when Prisma throws P2002', async () => {
    prismaUserCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '7.8.0', meta: { target: ['email'] } },
      ),
    );

    const result = await service.register({
      email: 'harshit@finpilot.com',
      password: 'Password1!',
    });

    expect(result).toEqual(GENERIC_RESPONSE);
  });

  it('re-throws non-P2002 errors instead of returning the generic message', async () => {
    const fatal = new Error('database is on fire');
    prismaUserCreate.mockRejectedValueOnce(fatal);

    await expect(
      service.register({
        email: 'harshit@finpilot.com',
        password: 'Password1!',
      }),
    ).rejects.toBe(fatal);
  });

  it('runs bcrypt.compare on the success path to equalize timing', async () => {
    await service.register({
      email: 'harshit@finpilot.com',
      password: 'Password1!',
    });

    expect(compareMock).toHaveBeenCalledTimes(1);
    // First argument to compare is the user-supplied password.
    expect(compareMock.mock.calls[0][0]).toBe('Password1!');
  });

  it('runs bcrypt.compare on the duplicate-email path to equalize timing', async () => {
    prismaUserCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '7.8.0' },
      ),
    );

    await service.register({
      email: 'harshit@finpilot.com',
      password: 'Password1!',
    });

    expect(compareMock).toHaveBeenCalledTimes(1);
    expect(compareMock.mock.calls[0][0]).toBe('Password1!');
  });
});