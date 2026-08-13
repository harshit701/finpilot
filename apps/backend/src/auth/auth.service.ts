import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '../generated/prisma/client';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import {
  JwtPayload,
  RefreshTokenPayload,
} from './interfaces/jwt-payload.interface';
import type { StringValue } from 'ms';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SessionsService } from '../sessions/sessions.service';
import type { AuthenticatedUser } from './types/authenticated-user.type';

/**
 * Response message returned by /auth/register.
 *
 * Intentionally identical for success, duplicate-email, and any other
 * non-error outcome. The endpoint must not leak whether an email is
 * already registered (defense against user-enumeration attacks).
 */
const REGISTER_GENERIC_RESPONSE = {
  message:
    'If the email is not already registered, a confirmation has been sent.',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionsService: SessionsService,
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

    const passwordHash = await this.hashPassword(password);

    // Equalize timing on the response so an attacker cannot distinguish
    // "email not registered" from "email already registered" by measuring
    // the duration of /auth/register. The dummy compare is a real bcrypt
    // comparison whose result we discard; it adds the same amount of work
    // to the success path as the failure path.
    const dummyHash = await this.getDummyPasswordHash();
    const equalize = bcrypt.compare(password, dummyHash);

    try {
      await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
        },
        omit: {
          passwordHash: true,
        },
      });
    } catch (err) {
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002';

      // Wait for the dummy compare regardless of branch so the two paths
      // take the same wall-clock time before responding.
      await equalize;

      if (isUniqueViolation) {
        return REGISTER_GENERIC_RESPONSE;
      }

      throw err;
    }

    await equalize;

    return REGISTER_GENERIC_RESPONSE;
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.findUserByEmail(email);

    // Equalize timing on the user-missing branch. The dummy compare is
    // a real bcrypt comparison whose result we discard.
    const dummyHash = await this.getDummyPasswordHash();
    const equalize = bcrypt.compare(password, dummyHash);

    if (!user || user.isDeleted) {
      await equalize;
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordMatch = await this.comparePasswords(
      password,
      user.passwordHash,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const familyId = randomUUID();
    const refreshToken = await this.generateRefreshToken(user, familyId);
    const session = await this.sessionsService.createSession(
      user.id,
      refreshToken,
      familyId,
    );
    const accessToken = await this.generateAccessToken(user, session.id);

    return { accessToken, refreshToken };
  }

  me(user: AuthenticatedUser) {
    return {
      user,
    };
  }

  async logout(sessionId: string) {
    await this.sessionsService.revokeOne(sessionId);

    return {
      message: 'Logged out successfully',
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const { refresh_token } = refreshTokenDto;

    const payload = await this.verifyRefreshToken(refresh_token);

    const session = await this.sessionsService.findByRawToken(refresh_token);

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt < new Date() ||
      session.familyId !== payload.family_id
    ) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }

    if (session.replacedById) {
      // The token being presented was already rotated away once. The only
      // explanation for it resurfacing is that two parties now hold a copy
      // of it, so the whole rotation family is killed rather than guessing
      // which party is legitimate.
      await this.sessionsService.revokeFamily(session.familyId);
      throw new UnauthorizedException('Invalid Refresh Token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      omit: { passwordHash: true },
    });

    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }

    const newRefreshToken = await this.generateRefreshToken(
      user,
      session.familyId,
    );
    const newSession = await this.sessionsService.rotate(
      session,
      user.id,
      newRefreshToken,
    );
    const accessToken = await this.generateAccessToken(user, newSession.id);

    return { accessToken, refreshToken: newRefreshToken };
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

  /**
   * Lazily-computed bcrypt hash used to equalize timing on /auth/register.
   * The plaintext is deliberately not a real password. The hash is never
   * persisted and is only used for a one-shot bcrypt.compare that we await
   * to consume CPU cycles.
   */
  private dummyPasswordHashPromise?: Promise<string>;

  private async getDummyPasswordHash(): Promise<string> {
    if (!this.dummyPasswordHashPromise) {
      const saltRounds = Number(
        this.configService.get<string>('BCRYPT_SALT_ROUNDS'),
      );
      this.dummyPasswordHashPromise = bcrypt.hash(
        'timing-equalization-only-not-a-real-password',
        saltRounds,
      );
    }
    return this.dummyPasswordHashPromise;
  }

  private async generateAccessToken(
    user: Pick<User, 'id' | 'isEmailVerified'>,
    sessionId: string,
  ) {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      sid: sessionId,
      emailVerified: user.isEmailVerified,
    };

    return this.jwtService.signAsync(payload);
  }

  private async generateRefreshToken(user: Pick<User, 'id'>, familyId: string) {
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      family_id: familyId,
      jti: randomUUID(),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<StringValue>(
        'JWT_REFRESH_EXPIRES_IN',
      ),
    });
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
