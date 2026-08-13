import { ConfigService } from '@nestjs/config';

export function isEmailVerificationEnforced(
  configService: ConfigService,
): boolean {
  return configService.get<string>('ENFORCE_EMAIL_VERIFICATION') === 'true';
}
