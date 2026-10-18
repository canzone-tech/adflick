import { IsIn } from 'class-validator';

export class UpdateAssetStatusDto {
  @IsIn(['REJECTED', 'ARCHIVED'])
  status!: 'REJECTED' | 'ARCHIVED';
}
