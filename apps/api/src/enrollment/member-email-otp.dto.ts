import { IsBoolean, IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateMemberOtpPolicyDto {
  @IsBoolean() emailEnabled!: boolean;
  @IsIn([6, 7, 8]) digits!: number;
  @IsInt() @Min(120) @Max(900) ttlSeconds!: number;
  @IsInt() @Min(30) @Max(300) resendSeconds!: number;
  @IsInt() @Min(3) @Max(8) maxAttempts!: number;
  @IsInt() @Min(0) expectedVersion!: number;
}

export class VerifyMemberEmailOtpDto {
  @IsString() @Matches(/^otp_[a-f0-9]{24}$/) challengeId!: string;
  @IsString() @Matches(/^\d{6,8}$/) code!: string;
}
