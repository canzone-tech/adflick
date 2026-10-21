import { Body, Controller, Get, Headers, Ip, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MfaEnrollDto } from './dto/mfa-enroll.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { MfaRotateDto } from './dto/mfa-rotate.dto';
import { MfaRecoverDto } from './dto/mfa-recover.dto';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, accessCookieOptions, clearCookieOptions, refreshCookieOptions } from './auth.cookies';
import type { Response, Request } from 'express';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly mfa: MfaService) {}

  private meta(ip?: string, userAgent?: string) { return { ipAddress: ip, userAgent }; }
  private setSessionCookies(res: Response, session: { accessToken: string; refreshToken: string }) {
    res.cookie(ACCESS_COOKIE_NAME, session.accessToken, accessCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions());
  }
  private clearSessionCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE_NAME, clearCookieOptions());
    res.clearCookie(REFRESH_COOKIE_NAME, clearCookieOptions());
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent: string | undefined, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(dto.email, dto.password, this.meta(ip, userAgent));
    this.setSessionCookies(res, session);
    return { user: session.user, expiresIn: session.expiresIn, refreshExpiresAt: session.refreshExpiresAt };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Ip() ip: string, @Headers('user-agent') userAgent: string | undefined, @Res({ passthrough: true }) res: Response) {
    const refreshToken = dto?.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
    const session = await this.auth.refresh(refreshToken ?? '', this.meta(ip, userAgent));
    this.setSessionCookies(res, session);
    return { user: session.user, expiresIn: session.expiresIn, refreshExpiresAt: session.refreshExpiresAt };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Body() dto: LogoutDto, @Req() req: Request, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    const refreshToken = dto?.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await this.auth.logout(refreshToken, actor, this.meta(ip));
    this.clearSessionCookies(res);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() actor: AuthenticatedUser) { return this.auth.me(actor); }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() actor: AuthenticatedUser) { return this.auth.changePassword(actor, dto.currentPassword, dto.newPassword); }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  mfaStatus(@CurrentUser() actor: AuthenticatedUser) { return this.mfa.status(actor); }

  @Post('mfa/enroll')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  mfaEnroll(@Body() dto: MfaEnrollDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) { return this.mfa.enroll(actor, dto.currentPassword, { ipAddress: ip }); }

  @Post('mfa/enroll/confirm')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  mfaEnrollConfirm(@Body() dto: MfaCodeDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) { return this.mfa.confirmEnrollment(actor, dto.code, { ipAddress: ip }); }

  @Post('mfa/challenge')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  mfaChallenge(@CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) { return this.mfa.createChallenge(actor, { ipAddress: ip }); }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async mfaVerify(@Body() dto: MfaVerifyDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    try {
      return await this.mfa.verifyChallenge(actor, dto.challengeId, dto.code, { ipAddress: ip });
    } catch (error) {
      if (error instanceof UnauthorizedException && error.message === 'MFA code was already used or the enrollment changed.') {
        throw new UnauthorizedException('MFA code has already been used or the enrollment changed.');
      }
      throw error;
    }
  }

  @Post('mfa/rotate')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  mfaRotate(@Body() dto: MfaRotateDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) { return this.mfa.rotate(actor, dto.currentPassword, dto.code, { ipAddress: ip }); }

  @Post('mfa/recover')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  mfaRecover(@Body() dto: MfaRecoverDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) { return this.mfa.recover(actor, dto.currentPassword, dto.recoveryCode, { ipAddress: ip }); }
}