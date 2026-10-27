import {
  BadRequestException, ConflictException, ForbiddenException, HttpException,
  Injectable, ServiceUnavailableException,
} from '@nestjs/common';
import {
  createCipheriv, createHmac, randomBytes, randomInt, timingSafeEqual,
} from 'node:crypto';
import { MemberPhoneOtpStatus, Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { requireOrganizationId, TenantScopeError } from '../auth/tenant-scope';
import { SmsGatewayService } from './sms-gateway.service';
import { RequestMemberPhoneOtpDto, VerifyMemberPhoneOtpDto } from './member-phone-otp.dto';

const rateLimited = () => new HttpException('Phone verification resend/hourly limit reached.', 429);

@Injectable()
export class MemberPhoneOtpService {
  constructor(private readonly prisma: PrismaService, private readonly sms: SmsGatewayService) {}

  private org(actor: AuthenticatedUser) {
    try { return requireOrganizationId(actor); }
    catch (e) {
      if (e instanceof TenantScopeError) throw new ForbiddenException('Organization context required.');
      throw e;
    }
  }

  private settings() {
    if (process.env.ADFLICK_MEMBER_PHONE_OTP_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Member phone OTP is disabled by operator policy.');
    }
    if (!this.sms.configurationReady()) {
      throw new ServiceUnavailableException('Approved SMS provider/template is not configured.');
    }
    const ttl = Number(process.env.ADFLICK_MEMBER_PHONE_OTP_TTL_SECONDS ?? '300');
    const resend = Number(process.env.ADFLICK_MEMBER_PHONE_OTP_RESEND_SECONDS ?? '60');
    const maxAttempts = Number(process.env.ADFLICK_MEMBER_PHONE_OTP_MAX_ATTEMPTS ?? '5');
    const hourlyCap = Number(process.env.ADFLICK_MEMBER_PHONE_OTP_HOURLY_CAP ?? '10');
    if (![ttl,resend,maxAttempts,hourlyCap].every(Number.isInteger) ||
        ttl < 120 || ttl > 900 || resend < 30 || resend > 300 ||
        maxAttempts < 3 || maxAttempts > 8 || hourlyCap < 1 || hourlyCap > 20) {
      throw new ServiceUnavailableException('Phone OTP security policy is outside approved safety limits.');
    }
    this.phoneKey();
    this.hash('configuration', 'configuration');
    return { ttl, resend, maxAttempts, hourlyCap };
  }

  private phoneKey() {
    const raw = process.env.ADFLICK_MEMBER_PHONE_DATA_KEY ?? '';
    let key: Buffer;
    try { key = Buffer.from(raw, 'base64url'); }
    catch { throw new ServiceUnavailableException('Phone encryption key is invalid.'); }
    if (key.length !== 32) throw new ServiceUnavailableException('Phone encryption key must be 256-bit.');
    return key;
  }

  private hash(label: string, value: string) {
    const key = process.env.ADFLICK_MEMBER_PHONE_OTP_HASH_PEPPER;
    if (!key || key.length < 32) throw new ServiceUnavailableException('Phone OTP signing secret missing.');
    return createHmac('sha256', key).update(label+':'+value).digest('hex');
  }

  private encrypt(phone: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.phoneKey(), iv);
    const payload = Buffer.concat([cipher.update(phone,'utf8'),cipher.final()]);
    return [iv,cipher.getAuthTag(),payload].map(part=>part.toString('base64url')).join('.');
  }

  async configuration(actor: AuthenticatedUser) {
    this.org(actor);
    const enabled = process.env.ADFLICK_MEMBER_PHONE_OTP_ENABLED === 'true';
    let ready = false;
    try { this.settings(); ready = true; } catch { /* deliberately default-deny */ }
    return {
      enabled, providerReady: this.sms.configurationReady(), ready,
      defaultOff: true, mobileVerifiedIsNotKyc: true,
      note: 'Only approved SMS provider configuration and legal templates permit sending. SMS API acceptance is not handset delivery proof.',
    };
  }

  private async eligible(org: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: org, status: UserStatus.ACTIVE,
        roleAssignments: { some: { role: UserRole.MEMBER } },
        memberProfile: { is: null } },
      select: { id: true },
    });
    if (!user) throw new ConflictException('Account cannot request an additional enrollment phone verification.');
    return user;
  }

  async request(actor: AuthenticatedUser, dto: RequestMemberPhoneOtpDto) {
    const policy = this.settings();
    const organizationId = this.org(actor);
    const user = await this.eligible(organizationId, actor.sub);
    const now = new Date();
    const id = 'ph_'+randomBytes(12).toString('hex');
    const code = randomInt(0,1_000_000).toString().padStart(6,'0');
    const phoneHash = this.hash('phone', dto.phone);
    const codeHash = this.hash('otp', [organizationId,user.id,id,code].join(':'));
    const phoneCiphertext = this.encrypt(dto.phone);
    const expiresAt = new Date(now.getTime()+policy.ttl*1000);
    const nextAllowedAt = new Date(now.getTime()+policy.resend*1000);
    try {
      await this.prisma.$transaction(async tx=>{
        // MySQL gives cross-instance safety: one cooldown per tenant/user,
        // plus per-phone hourly cap to discourage rotating accounts.
        const recentPhone = await tx.memberPhoneOtp.count({
          where: { organizationId, phoneHash, createdAt: { gt: new Date(now.getTime()-3_600_000) } },
        });
        if (recentPhone >= policy.hourlyCap) throw rateLimited();
        const key = { organizationId, userId: user.id };
        const throttle = await tx.memberPhoneOtpThrottle.findUnique({
          where: { organizationId_userId: key },
        });
        if (throttle) {
          const freshHour = now.getTime()-throttle.windowStart.getTime()>=3_600_000;
          if (throttle.nextAllowedAt>now ||
              (!freshHour && throttle.requestCount >= policy.hourlyCap)) throw rateLimited();
          const changed = await tx.memberPhoneOtpThrottle.updateMany({
            where: { ...key, requestCount: throttle.requestCount, nextAllowedAt: { lte: now } },
            data: {
              nextAllowedAt, windowStart: freshHour?now:throttle.windowStart,
              requestCount: freshHour?1:{ increment:1 },
            },
          });
          if (changed.count!==1) throw rateLimited();
        } else {
          await tx.memberPhoneOtpThrottle.create({
            data: { ...key, nextAllowedAt, windowStart: now, requestCount:1 },
          });
        }
        await tx.memberPhoneOtp.updateMany({
          where: { organizationId, userId:user.id,
            status:{ in: [MemberPhoneOtpStatus.QUEUED,MemberPhoneOtpStatus.SENT,MemberPhoneOtpStatus.VERIFIED] } },
          data: { status:MemberPhoneOtpStatus.FAILED },
        });
        await tx.memberPhoneOtp.create({
          data: { id, organizationId, userId:user.id, phoneHash, phoneCiphertext,
            phoneLast4:dto.phone.slice(-4),codeHash,
            maxAttempts:policy.maxAttempts,expiresAt,smsConsentAcceptedAt:now },
        });
        await tx.auditEvent.create({ data:{
          organizationId,actorUserId:actor.sub,action:'MEMBER_PHONE_OTP_REQUESTED',
          entityType:'MemberPhoneOtp',entityId:id,metadataJson:{smsConsentAccepted:true},
        } });
      },{ isolationLevel:Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2002','P2034'].includes(e.code)) throw rateLimited();
      throw e;
    }
    try {
      await this.sms.sendOtp(dto.phone,code,Math.ceil(policy.ttl/60),id);
      const accepted = await this.prisma.memberPhoneOtp.updateMany({
        where:{ id,organizationId,userId:user.id,status:MemberPhoneOtpStatus.QUEUED,
          expiresAt:{gt:new Date()} },
        data:{status:MemberPhoneOtpStatus.SENT,sentAt:new Date()},
      });
      if(accepted.count!==1) throw new Error('Phone OTP challenge expired.');
    } catch {
      await this.prisma.memberPhoneOtp.updateMany({
        where:{id,organizationId,userId:user.id,status:MemberPhoneOtpStatus.QUEUED},
        data:{status:MemberPhoneOtpStatus.FAILED},
      });
      throw new ServiceUnavailableException('Approved SMS gateway did not accept OTP. Retry after cooldown.');
    }
    return {
      challengeId:id,maskedPhone:'••••'+dto.phone.slice(-4),expiresAt,
      resendAfter:nextAllowedAt,
      message:'Approved SMS provider accepted verification request. Handset delivery is not guaranteed.',
    };
  }

  async verify(actor:AuthenticatedUser,dto:VerifyMemberPhoneOtpDto) {
    this.settings();
    const organizationId=this.org(actor);
    const now=new Date();
    const challenge=await this.prisma.memberPhoneOtp.findFirst({
      where:{ id:dto.challengeId,organizationId,userId:actor.sub },
      select:{id:true,status:true,attempts:true,maxAttempts:true,expiresAt:true,codeHash:true},
    });
    if(!challenge||challenge.status!==MemberPhoneOtpStatus.SENT||
        challenge.expiresAt<=now||challenge.attempts>=challenge.maxAttempts) {
      throw new BadRequestException('Verification challenge is invalid or expired.');
    }
    const expected=Buffer.from(challenge.codeHash,'hex');
    const received=Buffer.from(this.hash('otp',[organizationId,actor.sub,challenge.id,dto.code].join(':')),'hex');
    if(expected.length!==received.length||!timingSafeEqual(expected,received)) {
      const result=await this.prisma.memberPhoneOtp.updateMany({
        where:{id:challenge.id,organizationId,userId:actor.sub,status:MemberPhoneOtpStatus.SENT,
          attempts:challenge.attempts,expiresAt:{gt:now}},
        data:{attempts:{increment:1},...(challenge.attempts+1>=challenge.maxAttempts?
          {status:MemberPhoneOtpStatus.FAILED}:{})},
      });
      if(result.count!==1) throw new ConflictException('Concurrent OTP verification attempt.');
      throw new BadRequestException('Verification challenge is invalid or expired.');
    }
    await this.prisma.$transaction(async tx=>{
      const result=await tx.memberPhoneOtp.updateMany({
        where:{id:challenge.id,organizationId,userId:actor.sub,status:MemberPhoneOtpStatus.SENT,
          attempts:challenge.attempts,expiresAt:{gt:now}},
        data:{status:MemberPhoneOtpStatus.VERIFIED,verifiedAt:now},
      });
      if(result.count!==1) throw new ConflictException('OTP challenge already verified or used.');
      await tx.auditEvent.create({data:{
        organizationId,actorUserId:actor.sub,action:'MEMBER_PHONE_OTP_VERIFIED',
        entityType:'MemberPhoneOtp',entityId:challenge.id,
      }});
    });
    return {verified:true,expiresAt:challenge.expiresAt};
  }

  async status(actor:AuthenticatedUser) {
    const organizationId=this.org(actor);
    const now=new Date();
    const [verified,pending,throttle,member]=await Promise.all([
      this.prisma.memberPhoneOtp.findFirst({
        where:{organizationId,userId:actor.sub,status:MemberPhoneOtpStatus.VERIFIED,expiresAt:{gt:now}},
        orderBy:{createdAt:'desc'}, select:{phoneLast4:true,expiresAt:true},
      }),
      this.prisma.memberPhoneOtp.findFirst({
        where:{organizationId,userId:actor.sub,status:MemberPhoneOtpStatus.SENT,expiresAt:{gt:now}},
        orderBy:{createdAt:'desc'},select:{id:true,phoneLast4:true,expiresAt:true},
      }),
      this.prisma.memberPhoneOtpThrottle.findUnique({
        where:{organizationId_userId:{organizationId,userId:actor.sub}},
        select:{nextAllowedAt:true},
      }),
      this.prisma.verifiedMemberPhone.findFirst({
        where:{organizationId,userId:actor.sub},select:{phoneLast4:true,verifiedAt:true},
      }),
    ]);
    return {verified:!!verified||!!member,maskedPhone:verified?'••••'+verified.phoneLast4:
      member?'••••'+member.phoneLast4:pending?'••••'+pending.phoneLast4:null,
      expiresAt:verified?.expiresAt??pending?.expiresAt??null,
      pendingChallengeId:pending?.id??null,resendAfter:throttle?.nextAllowedAt??null,
      providerReady:this.sms.configurationReady(),
      channel:'SMS',pendingActivation:!!member};
  }
}
