import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { EmailVerifiedGuard } from './email-verified.guard';

function buildContext(user: { isEmailVerified: boolean } | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('EmailVerifiedGuard', () => {
  function build(requiresVerifiedEmail: boolean, enforced: boolean) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiresVerifiedEmail),
    } as unknown as Reflector;

    const configService = {
      get: jest.fn().mockReturnValue(enforced ? 'true' : 'false'),
    } as unknown as ConfigService;

    return new EmailVerifiedGuard(reflector, configService);
  }

  it('allows the request when the route has no @RequireVerifiedEmail metadata, regardless of the flag', () => {
    const guard = build(false, true);

    expect(guard.canActivate(buildContext({ isEmailVerified: false }))).toBe(
      true,
    );
  });

  it('allows the request when the route requires verification but the enforcement flag is off', () => {
    const guard = build(true, false);

    expect(guard.canActivate(buildContext({ isEmailVerified: false }))).toBe(
      true,
    );
  });

  it('allows the request when enforcement is on and the user is verified', () => {
    const guard = build(true, true);

    expect(guard.canActivate(buildContext({ isEmailVerified: true }))).toBe(
      true,
    );
  });

  it('throws ForbiddenException when enforcement is on and the user is unverified', () => {
    const guard = build(true, true);

    expect(() =>
      guard.canActivate(buildContext({ isEmailVerified: false })),
    ).toThrow(ForbiddenException);
  });
});
