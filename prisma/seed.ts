import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const demoSeedPassword = process.env.DEMO_SEED_PASSWORD;
  if (!demoSeedPassword || demoSeedPassword.length < 12) {
    throw new Error('Set DEMO_SEED_PASSWORD to a development-only password of at least 12 characters before seeding.');
  }
  const demoPasswordHash = await argon2.hash(demoSeedPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const organization = await prisma.organization.upsert({
    where: { slug: 'aj-ooba-demo' },
    update: { name: 'AJOOBA DIGITAL Demo Organization', isActive: true },
    create: {
      name: 'AJOOBA DIGITAL Demo Organization',
      slug: 'aj-ooba-demo',
      isActive: true,
    },
  });

  const demoUsers = [
    ['superadmin@adflick.demo', 'Demo Super Admin', UserRole.SUPER_ADMIN, null],
    ['orgadmin@adflick.demo', 'Demo Organization Admin', UserRole.ORGANIZATION_ADMIN, organization.id],
    ['advertiser@adflick.demo', 'Demo Advertiser', UserRole.ADVERTISER, organization.id],
    ['screenowner@adflick.demo', 'Demo Screen Owner', UserRole.SCREEN_OWNER, organization.id],
    ['content@adflick.demo', 'Demo Content Manager', UserRole.CONTENT_MANAGER, organization.id],
    ['operations@adflick.demo', 'Demo Operations Manager', UserRole.OPERATIONS_MANAGER, organization.id],
    ['finance@adflick.demo', 'Demo Finance Manager', UserRole.FINANCE_MANAGER, organization.id],
    ['support@adflick.demo', 'Demo Support Agent', UserRole.SUPPORT_AGENT, organization.id],
    ['auditor@adflick.demo', 'Demo Auditor / Compliance', UserRole.AUDITOR_COMPLIANCE, organization.id],
  ] as const;

  for (const [email, displayName, role, organizationId] of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { displayName, status: UserStatus.ACTIVE, organizationId, passwordHash: demoPasswordHash },
      create: { email, displayName, status: UserStatus.ACTIVE, organizationId, passwordHash: demoPasswordHash },
    });
    await prisma.userRoleAssignment.upsert({
      where: { userId_role: { userId: user.id, role } },
      update: {},
      create: { userId: user.id, role },
    });
  }

  const screenOwner = await prisma.user.findUnique({ where: { email: 'screenowner@adflick.demo' } });
  await prisma.screen.upsert({
    where: { externalCode: 'DEMO-TV-001' },
    update: { name: 'Demo Lobby Display', status: 'PENDING_PAIRING' },
    create: {
      organizationId: organization.id,
      ownerUserId: screenOwner?.id,
      name: 'Demo Lobby Display',
      externalCode: 'DEMO-TV-001',
      platform: 'ANDROID_TV',
      status: 'PENDING_PAIRING',
      timezone: 'Asia/Kolkata',
    },
  });

  await prisma.campaign.upsert({
    where: { id: 'demo-campaign-001' },
    update: {},
    create: {
      id: 'demo-campaign-001',
      organizationId: organization.id,
      name: 'Demo Campaign — Draft',
      status: 'DRAFT',
      currency: 'INR',
    },
  });

  console.log(`Seeded ${demoUsers.length} demo users, organization, screen and campaign.`);
  console.log('Development-only demo credentials seeded. Set DEMO_SEED_PASSWORD before seeding; never use demo credentials in production.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
