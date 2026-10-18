import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LogoutDto {
  @IsOptional()
  @IsString()
  @MinLength(40)
  @MaxLength(256)
  refreshToken?: string;
}
