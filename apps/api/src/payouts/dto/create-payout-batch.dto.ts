import { ArrayMinSize, IsArray, IsBoolean, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
class PayoutLineReviewDto {
  @IsString() @MaxLength(30) ledgerEntryId!: string;
  @IsBoolean() ownerIdentityVerified!: boolean;
  @IsBoolean() kycReviewed!: boolean;
  @IsBoolean() fraudReviewed!: boolean;
  @IsBoolean() taxReviewCompleted!: boolean;
}
export class CreatePayoutBatchDto {
  @IsString() @MaxLength(100) providerName!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PayoutLineReviewDto) items!: PayoutLineReviewDto[];
}
