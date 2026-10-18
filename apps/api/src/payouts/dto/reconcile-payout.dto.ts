import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
class ReconcileLineDto {
  @IsString() @MaxLength(30) payoutItemId!: string;
  @IsIn(['PAID', 'FAILED', 'HELD']) status!: 'PAID' | 'FAILED' | 'HELD';
  @IsOptional() @IsString() @MaxLength(160) providerReference?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class ReconcilePayoutDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReconcileLineDto) items!: ReconcileLineDto[];
}
