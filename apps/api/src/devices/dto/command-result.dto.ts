import { IsIn, IsOptional, IsObject, MaxLength, IsString } from 'class-validator';

export class CommandResultDto {
  @IsIn(['ACKNOWLEDGED','FAILED'])
  status!: 'ACKNOWLEDGED'|'FAILED';

  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;
}
