import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {

    healthCheck() {
        return {
            service: 'Auth Service',
            status: 'healthy',
            timestamp: new Date().toISOString()
        };
    }
}
