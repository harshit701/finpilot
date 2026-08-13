import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Session } from '../generated/prisma/client';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private expiryFromToken(rawToken: string): Date {
    const decoded = this.jwtService.decode<{ exp?: number }>(rawToken);

    if (!decoded?.exp) {
      throw new Error('Refresh token is missing an exp claim');
    }

    return new Date(decoded.exp * 1000);
  }

  async createSession(
    userId: string,
    rawRefreshToken: string,
    familyId: string,
  ): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawRefreshToken),
        familyId,
        expiresAt: this.expiryFromToken(rawRefreshToken),
      },
    });
  }

  async findByRawToken(rawToken: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });
  }

  async rotate(
    currentSession: Session,
    userId: string,
    newRawToken: string,
  ): Promise<Session> {
    return this.prisma.$transaction(async (tx) => {
      const newSession = await tx.session.create({
        data: {
          userId,
          tokenHash: this.hashToken(newRawToken),
          familyId: currentSession.familyId,
          expiresAt: this.expiryFromToken(newRawToken),
        },
      });

      await tx.session.update({
        where: { id: currentSession.id },
        data: { replacedById: newSession.id },
      });

      return newSession;
    });
  }

  private async revokeWhere(where: {
    id?: string;
    familyId?: string;
    userId?: string;
  }): Promise<void> {
    await this.prisma.session.updateMany({
      where: { ...where, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeOne(sessionId: string): Promise<void> {
    await this.revokeWhere({ id: sessionId });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.revokeWhere({ familyId });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.revokeWhere({ userId });
  }
}
