import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const enabled = process.env.RUN_MYSQL_SECURITY_E2E === '1';
const suite = enabled ? describe : describe.skip;

suite('MySQL-backed HttpOnly cookie authentication acceptance', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  let userId: string;
  const password = 'CookieAuth-Test-Password-2026!';
  const email = `cookie-auth-${Date.now()}@example.test`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.startsWith('mysql://')) throw new Error('Cookie auth E2E requires MySQL.');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const organization = await prisma.organization.create({
      data: { name: `Cookie Auth Org ${Date.now()}`, slug: `cookie-auth-${Date.now()}` },
      select: { id: true },
    });
    organizationId = organization.id;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: {
        email,
        displayName: 'Cookie Auth Test Admin',
        passwordHash,
        status: UserStatus.ACTIVE,
        organizationId,
        roleAssignments: { create: [{ role: UserRole.ORGANIZATION_ADMIN }] },
      },
      select: { id: true },
    });
    userId = user.id;
  }, 30_000);

  afterAll(async () => {
    if (prisma && userId) await prisma.user.delete({ where: { id: userId } });
    if (prisma && organizationId) await prisma.organization.delete({ where: { id: organizationId } });
    await app?.close();
  }, 30_000);

  it('authenticates through HttpOnly cookies without exposing bearer tokens in JSON', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent.post('/api/v1/auth/login').send({ email, password }).expect(201);
    expect(login.body.accessToken).toBeUndefined();
    expect(login.body.refreshToken).toBeUndefined();
    const cookies = (login.headers['set-cookie'] ?? []) as string[];
    expect(cookies.length).toBe(2);
    expect(cookies.every((cookie) => /HttpOnly/i.test(cookie))).toBe(true);
    expect(cookies.every((cookie) => /SameSite=Lax/i.test(cookie))).toBe(true);

    await agent.get('/api/v1/auth/me').expect(200).expect((response) => {
      expect(response.body.email).toBe(email);
      expect(response.body.roles).toContain('ORGANIZATION_ADMIN');
    });

    const refresh = await agent.post('/api/v1/auth/refresh').send({}).expect(201);
    expect(refresh.body.accessToken).toBeUndefined();
    expect(refresh.body.refreshToken).toBeUndefined();
    await agent.get('/api/v1/auth/me').expect(200);

    await agent.post('/api/v1/auth/logout').send({}).expect(201);
    await agent.get('/api/v1/auth/me').expect(401);
  });
});
