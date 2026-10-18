import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @MaxLength(180)
  title!: string;

  @IsString()
  @MaxLength(255)
  originalName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(524288000)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  checksumSha256?: string;
}
