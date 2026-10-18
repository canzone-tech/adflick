import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class DecisionDto {
  @IsIn(['APPROVED', 'REJECTED', 'ON_HOLD']) status!: 'APPROVED' | 'REJECTED' | 'ON_HOLD';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
