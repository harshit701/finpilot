/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Prisma's client type is intentionally not reproduced here; these mocks are plain jest.fn()s, matching how the pre-existing register() tests in auth.service.spec.ts mock PrismaService. */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { Session } from '../generated/prisma/client';

describe('SessionsService', () => {
  let service: SessionsService;
  let prismaSessionCreate: jest.Mock;
  let prismaSessionFindUnique: jest.Mock;
  let prismaSessionUpdate: jest.Mock;
  let prismaSessionUpdateMany: jest.Mock;
  let prismaTransaction: jest.Mock;
  let jwtDecode: jest.Mock;

  beforeEach(async () => {
    prismaSessionCreate = jest.fn().mockResolvedValue({ id: 'new-session' });
    prismaSessionFindUnique = jest.fn();
    prismaSessionUpdate = jest.fn();
    prismaSessionUpdateMany = jest.fn();

    const sessionDelegate = {
      create: prismaSessionCreate,
      findUnique: prismaSessionFindUnique,
      update: prismaSessionUpdate,
      updateMany: prismaSessionUpdateMany,
    };

    prismaTransaction = jest.fn(
      (fn: (tx: { session: typeof sessionDelegate }) => Promise<unknown>) =>
        fn({ session: sessionDelegate }),
    );

    const prismaMock = {
      session: sessionDelegate,
      $transaction: prismaTransaction,
    };

    jwtDecode = jest.fn().mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { decode: jwtDecode } },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
  });

  describe('createSession', () => {
    it('hashes the raw token and stores the given familyId with an exp-derived expiresAt', async () => {
      await service.createSession('user-1', 'raw-jwt-token', 'family-1');

      expect(prismaSessionCreate).toHaveBeenCalledTimes(1);
      const [call] = prismaSessionCreate.mock.calls[0];

      expect(call.data.userId).toBe('user-1');
      expect(call.data.familyId).toBe('family-1');
      expect(call.data.tokenHash).not.toBe('raw-jwt-token');
      expect(call.data.tokenHash).toHaveLength(64); // sha256 hex digest
      expect(call.data.expiresAt).toBeInstanceOf(Date);
    });

    it('throws if the token has no exp claim', async () => {
      jwtDecode.mockReturnValue({});

      await expect(
        service.createSession('user-1', 'raw-jwt-token', 'family-1'),
      ).rejects.toThrow('Refresh token is missing an exp claim');
    });
  });

  describe('findByRawToken', () => {
    it('looks up a session by the hash of the raw token', async () => {
      prismaSessionFindUnique.mockResolvedValue({ id: 'session-1' });

      const result = await service.findByRawToken('raw-jwt-token');

      expect(result).toEqual({ id: 'session-1' });
      const [call] = prismaSessionFindUnique.mock.calls[0];
      expect(call.where.tokenHash).toHaveLength(64);
    });
  });

  describe('rotate', () => {
    it('creates a new session with the same familyId and marks the old one replaced, transactionally', async () => {
      const currentSession: Session = {
        id: 'session-1',
        userId: 'user-1',
        tokenHash: 'old-hash',
        familyId: 'family-1',
        replacedById: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        revokedAt: null,
        createdAt: new Date(),
      };

      const result = await service.rotate(
        currentSession,
        'user-1',
        'new-raw-token',
      );

      expect(prismaTransaction).toHaveBeenCalledTimes(1);
      expect(prismaSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            familyId: 'family-1',
          }),
        }),
      );
      expect(prismaSessionUpdate).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { replacedById: 'new-session' },
      });
      expect(result).toEqual({ id: 'new-session' });
    });
  });

  describe('revocation', () => {
    it('revokeOne scopes updateMany to the single session id', async () => {
      await service.revokeOne('session-1');

      expect(prismaSessionUpdateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokeFamily scopes updateMany to the family id', async () => {
      await service.revokeFamily('family-1');

      expect(prismaSessionUpdateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokeAllForUser scopes updateMany to the user id', async () => {
      await service.revokeAllForUser('user-1');

      expect(prismaSessionUpdateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
