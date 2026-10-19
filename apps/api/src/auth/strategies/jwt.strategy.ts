import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ACCESS_COOKIE_NAME } from '../auth.cookies';

interface AccessPayload {
  sub: string;
  sid: string;
  email: string;
  organizationId: string | null;
  roles: string[];
  typ: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_ACCESS_SECRET must be set to at least 32 characters before starting the API.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => request.cookies?.[ACCESS_COOKIE_NAME] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AccessPayload): Promise<AuthenticatedUser> {
    if (payload.typ !== 'access' || !payload.sub || !payload.sid) {
      throw new UnauthorizedException('Invalid access token.');
    }
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
      select: { id: true, userId: true, expiresAt: true, revokedAt: true },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session is expired or revoked.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, organizationId: true, status: true,
        roleAssignments: { select: { role: true } },
      },
    });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active.');
    return {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roleAssignments.map((assignment) => assignment.role),
      sessionId: session.id,
    };
  }
}
