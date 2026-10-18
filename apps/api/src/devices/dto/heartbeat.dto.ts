import { IsOptional, IsString, MaxLength, IsInt, Min, Max, IsObject } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  @MaxLength(80)
  platform!: string;

  @IsString()
  @MaxLength(40)
  playerVersion!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ipAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  cpuPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  memoryPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  storagePercent?: number;

  @IsOptional()
  @IsObject()
  capabilities?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  manifestVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  playerError?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  syncStatus?: string;
}
