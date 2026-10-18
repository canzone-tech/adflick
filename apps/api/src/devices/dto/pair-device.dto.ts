import { IsString, MaxLength, MinLength } from 'class-validator';

export class PairDeviceDto {
  @IsString()
  @MinLength(8)
  @MaxLength(16)
  code!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(256)
  deviceSecret!: string;

  @IsString()
  @MaxLength(80)
  platform!: string;

  @IsString()
  @MaxLength(40)
  playerVersion!: string;
}
