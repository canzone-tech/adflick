import { IsBoolean, IsInt, IsOptional, Min, Max } from 'class-validator';

export class UpsertRewardPolicyDto {
  @IsOptional() @IsInt() @Min(0) tvMonthlyAmountPaise?: number;
  @IsOptional() @IsInt() @Min(0) smartphoneMonthlyAmountPaise?: number;
  @IsOptional() @IsInt() @Min(1) tvMinimumValidPlays?: number;
  @IsOptional() @IsInt() @Min(1) smartphoneMinimumValidPlays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) minimumCampaignCoveragePercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) minimumDeviceUptimePercent?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
