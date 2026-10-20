import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class MfaRotateDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
