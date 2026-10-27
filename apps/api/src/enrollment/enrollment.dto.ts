import { IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsString, Matches, MaxLength, MinLength, Equals } from 'class-validator';
import { BinarySide } from '@prisma/client';

export class CreateMemberPackageDto {
  @IsString() @IsNotEmpty() @MaxLength(60) @Matches(/^[a-zA-Z0-9_-]+$/) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
}
export class CreateMemberConsentDto {
  @IsString() @IsNotEmpty() @MaxLength(60) @Matches(/^[a-zA-Z0-9._-]+$/) version!: string;
  @IsString() @MinLength(20) @MaxLength(30000) documentText!: string;
}
export class ApprovalReferenceDto {
  @IsString() @MinLength(8) @MaxLength(240) approvalReference!: string;
}
export class IssueEnrollmentPinDto {
  @IsString() @IsNotEmpty() @MaxLength(30) recipientUserId!: string;
  @IsString() @IsNotEmpty() @MaxLength(60) packageCode!: string;
  @IsISO8601() expiresAt!: string;
}
export class RevokeEnrollmentPinDto {
  @IsString() @MinLength(8) @MaxLength(240) reason!: string;
}
export class EnrollExistingMemberDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,40}$/) sponsorMemberCode!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,40}$/) placementParentMemberCode!: string;
  @IsEnum(BinarySide) side!: BinarySide;
  @IsString() @Matches(/^[A-Za-z0-9._-]{1,60}$/) consentVersion!: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/i) consentDocumentSha256!: string;
  @IsBoolean() @Equals(true) consentAccepted!: boolean;
  @IsString() @Matches(/^[a-zA-Z0-9_-]{40,60}$/) pin!: string;
}
