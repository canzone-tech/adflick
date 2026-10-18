import { IsDateString } from 'class-validator';
export class CalculateRewardsDto {
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
}
