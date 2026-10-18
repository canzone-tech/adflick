import { IsString, MaxLength } from 'class-validator';
export class SubmitPayoutDto {
  @IsString() @MaxLength(100) providerName!: string;
  @IsString() @MaxLength(160) providerBatchReference!: string;
}
