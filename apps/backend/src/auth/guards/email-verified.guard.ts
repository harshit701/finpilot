import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { REQUIRE_VERIFIED_EMAIL_KEY } from '../decorators/require-verified-email.decorator';
import { isEmailVerificationEnforced } from '../config/auth-env.helper';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresVerifiedEmail = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_VERIFIED_EMAIL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresVerifiedEmail) {
      return true;
    }

    if (!isEmailVerificationEnforced(this.configService)) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();

    if (!request.user?.isEmailVerified) {
      throw new ForbiddenException('Please verify your email to continue.');
    }

    return true;
  }
}
