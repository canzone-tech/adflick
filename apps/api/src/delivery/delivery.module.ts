import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { StorageService } from '../cms/storage.service';

@Module({ controllers: [DeliveryController], providers: [DeliveryService, StorageService] })
export class DeliveryModule {}
