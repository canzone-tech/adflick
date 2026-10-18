import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { AssignmentsService } from './assignments.service';
import { AlertNotifierService } from '../notifications/alert-notifier.service';

@Module({ providers: [SchedulerService, AssignmentsService, AlertNotifierService], exports: [SchedulerService, AssignmentsService] })
export class SchedulerModule {}
