import { IsIn, IsInt, IsOptional, IsObject, Max, Min } from 'class-validator';

export class CreateCommandDto {
  @IsIn(['REFRESH_PLAYLIST','RESTART_PLAYER','RELOAD_APP','SET_VOLUME','TAKE_SCREENSHOT','SYNC_TIME'])
  type!: 'REFRESH_PLAYLIST'|'RESTART_PLAYER'|'RELOAD_APP'|'SET_VOLUME'|'TAKE_SCREENSHOT'|'SYNC_TIME';

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  ttlSeconds?: number;
}
