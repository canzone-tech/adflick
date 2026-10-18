import { IsIn } from 'class-validator';

export class UpdateScreenStatusDto {
  @IsIn(['SUSPENDED', 'RETIRED', 'OFFLINE'])
  status!: 'SUSPENDED'|'RETIRED'|'OFFLINE';
}
