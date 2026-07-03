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

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}
  async healthCheck() {
    const result = await this.prisma.user.count();

    return {
      service: this.configService.get<string>('APP_NAME'),
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: this.configService.get<string>('NODE_ENV'),
      userCount: result,
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

    const isPasswordMatch = await this.comparePasswords(
      password,
      user.passwordHash,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Please verify your email before logging in.',
      );
    }

    const tokens = await this.generateTokens(user);

    await this.saveRefreshTokenHash(user.id, tokens.refreshToken);

    return tokens;
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
    const payload = { sub: user.id, email: user.email };

    return this.jwtService.signAsync(payload);
  }

  private async generateRefreshToken(user: JwtPayload) {
    const payload = { sub: user.id, email: user.email };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: Number(
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
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
}
