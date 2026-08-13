import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { SessionsService } from '../sessions/sessions.service';

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
        {
          provide: SessionsService,
          useValue: {
            createSession: jest.fn(),
            findByRawToken: jest.fn(),
            rotate: jest.fn(),
            revokeOne: jest.fn(),
            revokeFamily: jest.fn(),
            revokeAllForUser: jest.fn(),
          },
        },
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
    expect(call.omit).toEqual({ passwordHash: true });
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

describe('AuthService — login', () => {
  let service: AuthService;
  let prismaUserFindUnique: jest.Mock;
  let sessionsService: {
    createSession: jest.Mock;
    findByRawToken: jest.Mock;
    rotate: jest.Mock;
    revokeOne: jest.Mock;
    revokeFamily: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  const existingUser = {
    id: 'user-id',
    email: 'harshit@finpilot.com',
    passwordHash: 'stored-hash',
    isEmailVerified: false,
    isDeleted: false,
  };

  beforeEach(async () => {
    hashMock.mockReset();
    compareMock.mockReset();
    hashMock.mockImplementation((plain: string) => `hashed:${plain}`);

    prismaUserFindUnique = jest.fn().mockResolvedValue(existingUser);

    const prismaMock = {
      user: { findUnique: prismaUserFindUnique },
    };

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'BCRYPT_SALT_ROUNDS') return '4';
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return 'value';
      }),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };

    sessionsService = {
      createSession: jest.fn().mockResolvedValue({ id: 'session-id' }),
      findByRawToken: jest.fn(),
      rotate: jest.fn(),
      revokeOne: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
        { provide: SessionsService, useValue: sessionsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('logs in an unverified user without blocking on email verification', async () => {
    compareMock.mockResolvedValue(true);

    const result = await service.login({
      email: 'harshit@finpilot.com',
      password: 'Password1!',
    });

    expect(result).toEqual({
      accessToken: 'signed-token',
      refreshToken: 'signed-token',
    });
    expect(sessionsService.createSession).toHaveBeenCalledWith(
      existingUser.id,
      'signed-token',
      expect.any(String),
    );
  });

  it('throws Unauthorized on wrong password', async () => {
    compareMock.mockResolvedValue(false);

    await expect(
      service.login({
        email: 'harshit@finpilot.com',
        password: 'WrongPassword1!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionsService.createSession).not.toHaveBeenCalled();
  });

  it('equalizes timing and throws Unauthorized when the user does not exist', async () => {
    prismaUserFindUnique.mockResolvedValue(null);
    compareMock.mockResolvedValue(false);

    await expect(
      service.login({
        email: 'nobody@finpilot.com',
        password: 'Password1!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    // The dummy compare (timing equalization) still ran on this branch.
    expect(compareMock).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService — refresh', () => {
  let service: AuthService;
  let prismaUserFindUnique: jest.Mock;
  let sessionsService: {
    createSession: jest.Mock;
    findByRawToken: jest.Mock;
    rotate: jest.Mock;
    revokeOne: jest.Mock;
    revokeFamily: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  const user = {
    id: 'user-id',
    isEmailVerified: false,
    isDeleted: false,
  };

  const validPayload = {
    sub: 'user-id',
    family_id: 'family-1',
    jti: 'jti-1',
  };

  const activeSession = {
    id: 'session-1',
    userId: 'user-id',
    familyId: 'family-1',
    replacedById: null as string | null,
    revokedAt: null as Date | null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  };

  beforeEach(async () => {
    prismaUserFindUnique = jest.fn().mockResolvedValue(user);

    const prismaMock = {
      user: { findUnique: prismaUserFindUnique },
    };

    const configService = {
      get: jest.fn(),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        return 'value';
      }),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('new-signed-token'),
      verifyAsync: jest.fn().mockResolvedValue(validPayload),
    };

    sessionsService = {
      createSession: jest.fn(),
      findByRawToken: jest.fn().mockResolvedValue(activeSession),
      rotate: jest.fn().mockResolvedValue({ id: 'session-2' }),
      revokeOne: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configService },
        { provide: JwtService, useValue: jwtService },
        { provide: SessionsService, useValue: sessionsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('rotates the session and returns a new token pair on the happy path', async () => {
    const result = await service.refresh({ refresh_token: 'old-token' });

    expect(result).toEqual({
      accessToken: 'new-signed-token',
      refreshToken: 'new-signed-token',
    });
    expect(sessionsService.rotate).toHaveBeenCalledWith(
      activeSession,
      user.id,
      'new-signed-token',
    );
    expect(sessionsService.revokeFamily).not.toHaveBeenCalled();
  });

  it('rejects when the session has been revoked', async () => {
    sessionsService.findByRawToken.mockResolvedValue({
      ...activeSession,
      revokedAt: new Date(),
    });

    await expect(
      service.refresh({ refresh_token: 'old-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the session has expired', async () => {
    sessionsService.findByRawToken.mockResolvedValue({
      ...activeSession,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.refresh({ refresh_token: 'old-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('detects reuse of an already-rotated token and revokes the whole family', async () => {
    sessionsService.findByRawToken.mockResolvedValue({
      ...activeSession,
      replacedById: 'session-2',
    });

    await expect(
      service.refresh({ refresh_token: 'already-rotated-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionsService.revokeFamily).toHaveBeenCalledWith('family-1');
    expect(sessionsService.rotate).not.toHaveBeenCalled();
  });

  it('rejects when the presented token fails signature/expiry verification', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad signature'));

    await expect(
      service.refresh({ refresh_token: 'tampered-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionsService.findByRawToken).not.toHaveBeenCalled();
  });
});

describe('AuthService — logout', () => {
  let service: AuthService;
  let sessionsService: {
    createSession: jest.Mock;
    findByRawToken: jest.Mock;
    rotate: jest.Mock;
    revokeOne: jest.Mock;
    revokeFamily: jest.Mock;
    revokeAllForUser: jest.Mock;
  };

  beforeEach(async () => {
    sessionsService = {
      createSession: jest.fn(),
      findByRawToken: jest.fn(),
      rotate: jest.fn(),
      revokeOne: jest.fn(),
      revokeFamily: jest.fn(),
      revokeAllForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() },
        },
        { provide: SessionsService, useValue: sessionsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('revokes exactly the session identified by the sid on the access token', async () => {
    await service.logout('session-1');

    expect(sessionsService.revokeOne).toHaveBeenCalledWith('session-1');
    expect(sessionsService.revokeOne).toHaveBeenCalledTimes(1);
  });
});
