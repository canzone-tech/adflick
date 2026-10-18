import { Module } from '@nestjs/common';
import { DevicesController, FleetController } from './devices.controller';
import { DevicesService } from './devices.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [SchedulerModule],
  controllers: [DevicesController, FleetController],
  providers: [DevicesService],
})
export class DevicesModule {}
