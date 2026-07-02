import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(private readonly configService: ConfigService) {}
  healthCheck() {
    return {
      service: this.configService.get<string>('APP_NAME'),
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
    };
  }
}
