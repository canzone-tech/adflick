import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [CmsController],
  providers: [CmsService, StorageService],
})
export class CmsModule {}
