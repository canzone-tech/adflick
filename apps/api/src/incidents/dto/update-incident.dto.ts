import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';

export class UpdateIncidentDto {
  @IsOptional() @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional() @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional() @IsString() @MaxLength(30)
  assignedToId?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  resolutionNote?: string;
}
