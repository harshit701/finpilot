import type { User } from '../../generated/prisma/client';

export type AuthenticatedUser = Omit<User, 'passwordHash'>;

/**
 * What JwtStrategy.validate() actually attaches to the request: the DB
 * user plus the session id (`sid`) carried on the access token claim, so
 * routes like logout can identify the current session without requiring
 * the refresh token to be resubmitted.
 */
export type RequestUser = AuthenticatedUser & { sid: string };
