import { IsString, MaxLength, MinLength } from 'class-validator';

export class MfaEnrollDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  currentPassword!: string;
}
