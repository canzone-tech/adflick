import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LayoutZoneDto {
  @IsString()
  @MaxLength(40)
  id!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;

  @IsInt()
  @Min(1)
  width!: number;

  @IsInt()
  @Min(1)
  height!: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  type?: string;
}

export class CreateLayoutDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(320)
  @Max(7680)
  canvasWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(240)
  @Max(4320)
  canvasHeight?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutZoneDto)
  zones!: LayoutZoneDto[];
}
