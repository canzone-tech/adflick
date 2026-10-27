import { Equals, IsBoolean, IsString, Matches } from 'class-validator';

export class RequestMemberPhoneOtpDto {
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @IsBoolean() @Equals(true) smsConsentAccepted!: boolean;
}
export class VerifyMemberPhoneOtpDto {
  @IsString() @Matches(/^ph_[a-f0-9]{24}$/) challengeId!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
