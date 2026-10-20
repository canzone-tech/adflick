import { IsString, MaxLength, MinLength } from 'class-validator';

export class MfaRecoverDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(64)
  recoveryCode!: string;
}
