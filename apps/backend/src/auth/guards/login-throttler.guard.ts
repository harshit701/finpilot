import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Keys the login rate limiter by the normalized email in the request body
 * instead of the caller's IP address, per the per-email login-rate-limit
 * decision — one address can legitimately represent several people, but
 * repeated failures against a single account are what credential stuffing
 * looks like.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const body = req?.body as { email?: unknown } | undefined;
    const email = body?.email;

    if (typeof email === 'string' && email.trim().length > 0) {
      return `login:${email.trim().toLowerCase()}`;
    }

    return super.getTracker(req);
  }
}
