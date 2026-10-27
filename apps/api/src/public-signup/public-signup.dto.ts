import { Equals, IsBoolean, IsEmail, IsInt, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class PublicSignupStartDto {
  @IsString() @Matches(/^[a-z0-9-]{3,180}$/) organizationSlug!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Matches(/^[^\r\n<>]{2,160}$/) displayName!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
  @IsString() @Matches(/^[A-Za-z0-9._-]{1,60}$/) consentVersion!: string;
  @IsString() @Matches(/^[a-fA-F0-9]{64}$/) consentDocumentSha256!: string;
  @IsBoolean() @Equals(true) consentAccepted!: boolean;
}

export class PublicSignupVerifyDto {
  @IsString() @Matches(/^ps_[a-f0-9]{24}$/) requestId!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}

export class PublicSignupPolicyDto {
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(0) expectedVersion!: number;
}
