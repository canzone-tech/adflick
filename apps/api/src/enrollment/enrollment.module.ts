import { Module } from '@nestjs/common';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { SmtpMailService } from './smtp-mail.service';
import { MemberEmailOtpController } from './member-email-otp.controller';
import { MemberEmailOtpService } from './member-email-otp.service';
import { MemberPhoneOtpService } from './member-phone-otp.service';
import { MemberPhoneOtpController } from './member-phone-otp.controller';
import { SmsGatewayService } from './sms-gateway.service';

@Module({
  controllers: [EnrollmentController, MemberEmailOtpController, MemberPhoneOtpController],
  providers: [EnrollmentService, SmtpMailService, MemberEmailOtpService, MemberPhoneOtpService, SmsGatewayService],
})
export class EnrollmentModule {}
