import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateScreenDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(60)
  platform!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ownerUserId?: string;
}
