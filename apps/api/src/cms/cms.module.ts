import { Module } from '@nestjs/common';
import { CmsController } from './cms.controller';
import { CmsService } from './cms.service';
import { StorageService } from './storage.service';
import { MediaVerificationService } from './media-verification.service';

@Module({
  controllers: [CmsController],
  providers: [CmsService, StorageService, MediaVerificationService],
})
export class CmsModule {}
