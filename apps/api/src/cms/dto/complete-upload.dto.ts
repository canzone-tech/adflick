import { IsString, Matches } from 'class-validator';

export class CompleteUploadDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string;
}
