import { randomUUID } from 'node:crypto';
import { Prisma } from '../../src/generated/prisma/client';

/**
 * A minimal in-memory stand-in for PrismaService, covering only the User
 * and Session operations the auth flow actually issues. Used to override
 * PrismaService in e2e-style (full HTTP stack via supertest) specs so they
 * never touch the real database — per team preference, no test (unit, e2e,
 * or manual) should write to a real/dev database, even with cleanup after.
 */

interface InMemoryUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  passwordHash: string;
  isEmailVerified: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface InMemorySession {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  replacedById: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

interface InMemoryPrismaShape {
  user: {
    create: (args: {
      data: Partial<InMemoryUser> & { email: string; passwordHash: string };
      omit?: Partial<Record<keyof InMemoryUser, boolean>>;
    }) => Promise<Partial<InMemoryUser>>;
    findUnique: (args: {
      where: { id?: string; email?: string };
      omit?: Partial<Record<keyof InMemoryUser, boolean>>;
    }) => Promise<Partial<InMemoryUser> | null>;
  };
  session: {
    create: (args: {
      data: Pick<
        InMemorySession,
        'userId' | 'tokenHash' | 'familyId' | 'expiresAt'
      >;
    }) => Promise<InMemorySession>;
    findUnique: (args: {
      where: { id?: string; tokenHash?: string };
    }) => Promise<InMemorySession | null>;
    update: (args: {
      where: { id: string };
      data: Partial<InMemorySession>;
    }) => Promise<InMemorySession>;
    updateMany: (args: {
      where: {
        id?: string;
        familyId?: string;
        userId?: string;
        revokedAt?: null;
      };
      data: Partial<InMemorySession>;
    }) => Promise<{ count: number }>;
  };
  $transaction: <T>(fn: (tx: InMemoryPrismaShape) => Promise<T>) => Promise<T>;
}

function applyOmit<T extends object>(
  record: T,
  omit?: Partial<Record<keyof T, boolean>>,
): T {
  if (!omit) return { ...record };
  const clone = { ...record };
  for (const key of Object.keys(omit) as (keyof T)[]) {
    if (omit[key]) delete clone[key];
  }
  return clone;
}

export function createInMemoryPrisma() {
  const users = new Map<string, InMemoryUser>();
  const sessions = new Map<string, InMemorySession>();

  const userDelegate = {
    create: ({
      data,
      omit,
    }: {
      data: Partial<InMemoryUser> & { email: string; passwordHash: string };
      omit?: Partial<Record<keyof InMemoryUser, boolean>>;
    }) => {
      const emailTaken = [...users.values()].some(
        (u) => u.email === data.email,
      );

      if (emailTaken) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`email`)',
          {
            code: 'P2002',
            clientVersion: 'in-memory-test',
            meta: { target: ['email'] },
          },
        );
      }

      const now = new Date();
      const user: InMemoryUser = {
        id: randomUUID(),
        email: data.email,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        passwordHash: data.passwordHash,
        isEmailVerified: data.isEmailVerified ?? false,
        isDeleted: data.isDeleted ?? false,
        createdAt: now,
        updatedAt: now,
      };
      users.set(user.id, user);

      return Promise.resolve(applyOmit(user, omit));
    },

    findUnique: ({
      where,
      omit,
    }: {
      where: { id?: string; email?: string };
      omit?: Partial<Record<keyof InMemoryUser, boolean>>;
    }) => {
      let user: InMemoryUser | undefined;

      if (where.id) {
        user = users.get(where.id);
      } else if (where.email) {
        user = [...users.values()].find((u) => u.email === where.email);
      }

      return Promise.resolve(user ? applyOmit(user, omit) : null);
    },
  };

  const sessionDelegate = {
    create: ({
      data,
    }: {
      data: Pick<
        InMemorySession,
        'userId' | 'tokenHash' | 'familyId' | 'expiresAt'
      >;
    }) => {
      const session: InMemorySession = {
        id: randomUUID(),
        userId: data.userId,
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        replacedById: null,
        expiresAt: data.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };
      sessions.set(session.id, session);

      return Promise.resolve(session);
    },

    findUnique: ({ where }: { where: { id?: string; tokenHash?: string } }) => {
      let session: InMemorySession | undefined;

      if (where.tokenHash) {
        session = [...sessions.values()].find(
          (s) => s.tokenHash === where.tokenHash,
        );
      } else if (where.id) {
        session = sessions.get(where.id);
      }

      return Promise.resolve(session ?? null);
    },

    update: ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<InMemorySession>;
    }) => {
      const session = sessions.get(where.id);
      if (!session) {
        throw new Error(`in-memory session ${where.id} not found`);
      }
      Object.assign(session, data);
      return Promise.resolve(session);
    },

    updateMany: ({
      where,
      data,
    }: {
      where: {
        id?: string;
        familyId?: string;
        userId?: string;
        revokedAt?: null;
      };
      data: Partial<InMemorySession>;
    }) => {
      let count = 0;

      for (const session of sessions.values()) {
        if (where.id && session.id !== where.id) continue;
        if (where.familyId && session.familyId !== where.familyId) continue;
        if (where.userId && session.userId !== where.userId) continue;
        if (
          'revokedAt' in where &&
          where.revokedAt === null &&
          session.revokedAt !== null
        ) {
          continue;
        }

        Object.assign(session, data);
        count++;
      }

      return Promise.resolve({ count });
    },
  };

  const prisma: InMemoryPrismaShape = {
    user: userDelegate,
    session: sessionDelegate,
    $transaction: (fn) => fn(prisma),
  };

  return prisma;
}

export type InMemoryPrisma = ReturnType<typeof createInMemoryPrisma>;
