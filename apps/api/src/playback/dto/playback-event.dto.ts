import { IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PlaybackEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  authorizationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  authorizationToken?: string;

  @IsString()
  @MaxLength(100)
  eventId!: string;

  @IsIn(['PLAY_STARTED','PLAY_COMPLETED','PLAY_INTERRUPTED','PLAY_ERROR'])
  eventType!: 'PLAY_STARTED'|'PLAY_COMPLETED'|'PLAY_INTERRUPTED'|'PLAY_ERROR';

  @IsString()
  @MaxLength(30)
  assetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  playlistId?: string;

  @IsOptional()
  @IsISO8601()
  startedAt?: string;

  @IsOptional()
  @IsISO8601()
  completedAt?: string;

  @IsOptional()
  @IsISO8601()
  clientReportedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400000)
  durationMs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400000)
  expectedDurationMs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sequenceNumber?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
