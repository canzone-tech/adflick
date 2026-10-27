import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AccessController } from './auth/access.controller';
import { CmsModule } from './cms/cms.module';
import { DevicesModule } from './devices/devices.module';
import { PlaybackModule } from './playback/playback.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { DeliveryModule } from './delivery/delivery.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { IncidentsModule } from './incidents/incidents.module';
import { FinanceModule } from './finance/finance.module';
import { PayoutsModule } from './payouts/payouts.module';
import { MembersModule } from './members/members.module';

@Module({
  imports: [PrismaModule, AuthModule, CmsModule, DevicesModule, PlaybackModule, CampaignsModule, DeliveryModule, SchedulerModule, IncidentsModule, FinanceModule, PayoutsModule, MembersModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [HealthController, AccessController],
})
export class AppModule {}
