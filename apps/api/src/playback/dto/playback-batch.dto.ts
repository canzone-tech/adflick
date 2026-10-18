import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PlaybackEventDto } from './playback-event.dto';

export class PlaybackBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlaybackEventDto)
  events!: PlaybackEventDto[];
}
