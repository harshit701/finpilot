import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { RequestUser } from './types/authenticated-user.type';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    healthCheck: jest.Mock;
    register: jest.Mock;
    login: jest.Mock;
    logout: jest.Mock;
    me: jest.Mock;
    refresh: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      healthCheck: jest.fn(),
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      me: jest.fn(),
      refresh: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 4 }]),
      ],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('logout passes the current session id (from the access token) to the service', async () => {
    const user = { id: 'user-1', sid: 'session-1' } as RequestUser;

    await controller.logout(user);

    expect(authService.logout).toHaveBeenCalledWith('session-1');
  });
});
