import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  @MinLength(20)
  @MaxLength(64)
  challengeId!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
