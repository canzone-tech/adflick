import { Module } from '@nestjs/common';
import { AlertNotifierService } from './alert-notifier.service';
import { NotificationOutboxService } from './notification-outbox.service';

@Module({ providers: [AlertNotifierService, NotificationOutboxService], exports: [AlertNotifierService, NotificationOutboxService] })
export class NotificationsModule {}
