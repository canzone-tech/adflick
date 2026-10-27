import { Module } from '@nestjs/common';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { SmtpMailService } from './smtp-mail.service';
import { MemberEmailOtpController } from './member-email-otp.controller';
import { MemberEmailOtpService } from './member-email-otp.service';

@Module({
  controllers: [EnrollmentController, MemberEmailOtpController],
  providers: [EnrollmentService, SmtpMailService, MemberEmailOtpService],
})
export class EnrollmentModule {}
