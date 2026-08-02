import type { User } from '../../generated/prisma/client';

export type AuthenticatedUser = Omit<User, 'passwordHash' | 'refreshToken'>;
