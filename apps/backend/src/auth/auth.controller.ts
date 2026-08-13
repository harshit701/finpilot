import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';
import { CurrentUser } from './decorators/get-user.decorator';
import type {
  AuthenticatedUser,
  RequestUser,
} from './types/authenticated-user.type';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('health')
  health() {
    return this.authService.healthCheck();
  }

  @Post('register')
  register(@Body() registerUserDto: RegisterUserDto) {
    return this.authService.register(registerUserDto);
  }

  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 4, ttl: seconds(60) } })
  @Post('login')
  login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: RequestUser) {
    return this.authService.logout(user.sid);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  @ApiBearerAuth('JWT-auth')
  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto);
  }
}
