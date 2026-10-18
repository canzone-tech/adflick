import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PlaylistItemDto {
  @IsString()
  @MaxLength(30)
  assetId!: string;

  @IsInt()
  @Min(1)
  @Max(86400000)
  durationMs!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  order?: number;
}

export class CreatePlaylistDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlaylistItemDto)
  items!: PlaylistItemDto[];
}
