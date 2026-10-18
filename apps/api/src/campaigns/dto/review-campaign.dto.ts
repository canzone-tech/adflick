import { IsString, MaxLength } from 'class-validator';
export class ReviewCampaignDto {
  @IsString() @MaxLength(1000) note!: string;
}
