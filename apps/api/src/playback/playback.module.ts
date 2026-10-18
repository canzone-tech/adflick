import { Module } from '@nestjs/common';
import { DevicePlaybackController, PlaybackReportsController } from './playback.controller';
import { PlaybackService } from './playback.service';

@Module({
  controllers: [DevicePlaybackController, PlaybackReportsController],
  providers: [PlaybackService],
})
export class PlaybackModule {}
