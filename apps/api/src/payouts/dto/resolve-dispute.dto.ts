import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
export class ResolveDisputeDto {
  @IsIn(['UNDER_REVIEW','RESOLVED_OWNER_FAVOUR','RESOLVED_ORGANIZATION_FAVOUR','CLOSED']) status!: 'UNDER_REVIEW'|'RESOLVED_OWNER_FAVOUR'|'RESOLVED_ORGANIZATION_FAVOUR'|'CLOSED';
  @IsString() @MinLength(3) @MaxLength(1000) note!: string;
}
