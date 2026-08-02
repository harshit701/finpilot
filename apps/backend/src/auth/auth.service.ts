import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import type { StringValue } from 'ms';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}
  healthCheck() {
    return {
      service: this.configService.get<string>('APP_NAME'),
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: this.configService.get<string>('NODE_ENV'),
    };
  }

  async register(registerUserDto: RegisterUserDto) {
    const { email, password, firstName, lastName } = registerUserDto;

    const existingUser = await this.findUserByEmail(email);

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const passwordHash = await this.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
      },
      omit: {
        passwordHash: true,
        refreshToken: true,
      },
    });

    return {
      message: 'User registered successfully',
      user,
    };
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.findUserByEmail(email);

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Please verify your email before logging in.',
      );
    }

    const isPasswordMatch = await this.comparePasswords(
      password,
      user.passwordHash,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);

    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return tokens;
  }

  me(user: JwtPayload) {
    return {
      user,
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshToken: null,
      },
    });

    return {
      message: 'Logged out successfully',
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const { refresh_token } = refreshTokenDto;

    const payload = await this.verifyRefreshToken(refresh_token);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      omit: {
        passwordHash: true,
      },
    });

    if (!user || user.isDeleted || !user.refreshToken) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }

    try {
      const isValid = await this.validateRefreshToken(
        refresh_token,
        user.refreshToken as string,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid Refresh Token');
      }

      const tokens = await this.generateTokens(payload);

      await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid Refresh Token');
    }
  }

  private async findUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user;
  }

  private async hashPassword(password: string) {
    const saltRounds = Number(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS'),
    );
    return bcrypt.hash(password, saltRounds);
  }

  private async comparePasswords(password: string, hashedPassword: string) {
    return bcrypt.compare(password, hashedPassword);
  }

  private async generateAccessToken(user: JwtPayload) {
    const payload = { id: user.id, email: user.email };

    return this.jwtService.signAsync(payload);
  }

  private async generateRefreshToken(user: JwtPayload) {
    const payload = { id: user.id, email: user.email };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<StringValue>(
        'JWT_REFRESH_EXPIRES_IN',
      ),
    });
  }

  private async generateTokens(user: JwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(user),
      this.generateRefreshToken(user),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private async saveRefreshTokenHash(userId: string, refreshToken: string) {
    const refreshTokenHash = await this.hashPassword(refreshToken);

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshToken: refreshTokenHash,
      },
    });
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async validateRefreshToken(
    refreshToken: string,
    refreshTokenHash: string | null,
  ) {
    if (!refreshTokenHash) {
      return false;
    }

    return bcrypt.compare(refreshToken, refreshTokenHash);
  }
}
