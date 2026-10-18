import { IsString, Length, Matches } from 'class-validator';

export class ReserveReconciliationImportDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[A-Za-z0-9._-]+$/)
  providerName!: string;

  @IsString()
  @Length(1, 180)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;

  /** Exact provider statement payload; only its digest is persisted. */
  @IsString()
  @Length(1, 10000000)
  payload!: string;
}
