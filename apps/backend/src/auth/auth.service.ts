import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import type { StringValue } from 'ms';
import { RefreshTokenDto } from './dto/refresh-token.dto';

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
          refreshToken: true,
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

    const isValid = await this.validateRefreshToken(
      refresh_token,
      user.refreshToken,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }

    // Re-derive the email from the database so the new access token reflects
    // the user's current email rather than the value baked into the refresh
    // token at sign-in time.
    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
    });

    const newRefreshTokenHash = await this.hashPassword(tokens.refreshToken);

    // Atomic rotation: optimistic lock on the existing refresh-token hash.
    // If two concurrent refresh requests both pass `validateRefreshToken`
    // against the same old hash, only the first `updateMany` will match the
    // WHERE clause; the second sees `count === 0` (the hash was already
    // overwritten) and is rejected. This eliminates the silent-loss race
    // that the previous read-then-write flow had.
    //
    // `isDeleted: false` in the WHERE clause is belt-and-braces against the
    // user being soft-deleted between the load and the update.
    const updateResult = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        isDeleted: false,
        refreshToken: user.refreshToken,
      },
      data: {
        refreshToken: newRefreshTokenHash,
      },
    });

    if (updateResult.count === 0) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }

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
