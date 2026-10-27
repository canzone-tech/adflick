import { Module } from '@nestjs/common';
import { PublicSignupController, PublicSignupAdminController } from './public-signup.controller';
import { PublicSignupService } from './public-signup.service';
import { SmtpMailService } from '../enrollment/smtp-mail.service';

@Module({
  controllers: [PublicSignupController, PublicSignupAdminController],
  providers: [PublicSignupService, SmtpMailService],
})
export class PublicSignupModule {}
