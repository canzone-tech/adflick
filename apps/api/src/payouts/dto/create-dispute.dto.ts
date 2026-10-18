import { IsString, MaxLength, MinLength } from 'class-validator';
export class CreateDisputeDto {
  @IsString() @MaxLength(30) ledgerEntryId!: string;
  @IsString() @MinLength(3) @MaxLength(80) reasonCode!: string;
  @IsString() @MinLength(10) @MaxLength(1000) description!: string;
}
