import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IncidentCategory, IncidentSeverity } from '@prisma/client';

export class CreateIncidentDto {
  @IsString() @MaxLength(180)
  title!: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(30)
  screenId?: string;

  @IsOptional() @IsEnum(IncidentCategory)
  category?: IncidentCategory;

  @IsOptional() @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;
}
