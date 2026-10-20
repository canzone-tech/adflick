import {
  Injectable, UnauthorizedException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_BYTES, REFRESH_TOKEN_TTL_DAYS } from './auth.constants';
import { AuthenticatedUser } from './decorators/current-user.decorator';

type RequestMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(emailInput: string, password: string, meta: RequestMeta) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true, email: true, displayName: true, passwordHash: true,
        status: true, organizationId: true,
        roleAssignments: { select: { role: true } },
      },
    });
    // Same public error for unknown account and bad password.
    if (!user || !user.passwordHash || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) throw new UnauthorizedException('Invalid email or password.');

    const rawRefreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 512),
        ipAddress: meta.ipAddress?.slice(0, 45),
      },
      select: { id: true, expiresAt: true },
    });
    const roles = user.roleAssignments.map((x) => x.role);
    const accessToken = await this.jwt.signAsync({
      sub: user.id, sid: session.id, email: user.email,
      organizationId: user.organizationId, roles, typ: 'access',
    }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL_SECONDS });

    await this.prisma.auditEvent.create({
      data: {
        actorUserId: user.id, organizationId: user.organizationId,
        action: 'AUTH_LOGIN_SUCCESS', entityType: 'User', entityId: user.id,
        ipAddress: meta.ipAddress?.slice(0, 45),
      },
    });
    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: rawRefreshToken,
      refreshExpiresAt: session.expiresAt,
      user: { id: user.id, email: user.email, displayName: user.displayName, organizationId: user.organizationId, roles },
    };
  }

  async refresh(rawToken: string, meta: RequestMeta) {
    if (!rawToken || rawToken.length > 256) throw new UnauthorizedException('Invalid refresh token.');
    const tokenHash = this.hashToken(rawToken);
    const current = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, email: true, displayName: true, organizationId: true, status: true, roleAssignments: { select: { role: true } } } },
      },
    });
    if (!current || current.revokedAt || current.expiresAt <= new Date() || current.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Refresh token is expired, revoked or invalid.');
    }

    const nextRawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const nextId = `rs_${randomBytes(12).toString('hex')}`;
    const now = new Date();

    // Atomic rotation: a token can only be consumed once.
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.refreshSession.updateMany({
        where: { id: current.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now, replacedById: nextId },
      });
      if (changed.count !== 1) throw new UnauthorizedException('Refresh token has already been used.');
      await tx.refreshSession.create({
        data: {
          id: nextId,
          userId: current.userId,
          tokenHash: this.hashToken(nextRawToken),
          expiresAt: nextExpiresAt,
          userAgent: meta.userAgent?.slice(0, 512),
          ipAddress: meta.ipAddress?.slice(0, 45),
        },
      });
    });

    const roles = current.user.roleAssignments.map((x) => x.role);
    const accessToken = await this.jwt.signAsync({
      sub: current.user.id, sid: nextId, email: current.user.email,
      organizationId: current.user.organizationId, roles, typ: 'access',
    }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    return {
      tokenType: 'Bearer', accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: nextRawToken, refreshExpiresAt: nextExpiresAt,
      user: { id: current.user.id, email: current.user.email, displayName: current.user.displayName, organizationId: current.user.organizationId, roles },
    };
  }

  async logout(refreshToken: string | undefined, actor?: AuthenticatedUser, meta: RequestMeta = {}) {
    if (refreshToken) {
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (actor) {
      await this.prisma.refreshSession.updateMany({
        where: { id: actor.sessionId, userId: actor.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.prisma.auditEvent.create({
        data: {
          actorUserId: actor.sub, organizationId: actor.organizationId,
          action: 'AUTH_LOGOUT', entityType: 'User', entityId: actor.sub,
          ipAddress: meta.ipAddress?.slice(0, 45),
        },
      });
    }
    return { success: true };
  }

  async me(actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { id: true, email: true, displayName: true, status: true, organizationId: true, roleAssignments: { select: { role: true } } },
    });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active.');
    return { ...user, roles: user.roleAssignments.map((x) => x.role), roleAssignments: undefined };
  }

  async verifyCurrentPassword(userId: string, currentPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, currentPassword).catch(() => false))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
  }

  async changePassword(actor: AuthenticatedUser, currentPassword: string, newPassword: string) {
    if (newPassword.length < 12 || newPassword.length > 128) {
      throw new BadRequestException('New password must be between 12 and 128 characters.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: actor.sub }, select: { id: true, passwordHash: true, organizationId: true } });
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, currentPassword).catch(() => false))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: actor.sub }, data: { passwordHash } }),
      this.prisma.refreshSession.updateMany({ where: { userId: actor.sub, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditEvent.create({
        data: { actorUserId: actor.sub, organizationId: user.organizationId, action: 'AUTH_PASSWORD_CHANGED', entityType: 'User', entityId: actor.sub, severity: 'WARNING' },
      }),
    ]);
    return { success: true, message: 'Password changed. Please sign in again on all devices.' };
  }
}
