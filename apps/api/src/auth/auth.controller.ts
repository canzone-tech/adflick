import { Body, Controller, Headers, Ip, Post, UseGuards, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, accessCookieOptions, clearCookieOptions, refreshCookieOptions } from './auth.cookies';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(ip?: string, userAgent?: string) {
    return { ipAddress: ip, userAgent };
  }

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
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(dto.email, dto.password, this.meta(ip, userAgent));
    this.setSessionCookies(res, session);
    return {
      user: session.user,
      expiresIn: session.expiresIn,
      refreshExpiresAt: session.refreshExpiresAt,
    };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto?.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
    const session = await this.auth.refresh(refreshToken ?? '', this.meta(ip, userAgent));
    this.setSessionCookies(res, session);
    return {
      user: session.user,
      expiresIn: session.expiresIn,
      refreshExpiresAt: session.refreshExpiresAt,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() dto: LogoutDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthenticatedUser,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto?.refreshToken ?? req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await this.auth.logout(refreshToken, actor, this.meta(ip));
    this.clearSessionCookies(res);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() actor: AuthenticatedUser) {
    return this.auth.me(actor);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.auth.changePassword(actor, dto.currentPassword, dto.newPassword);
  }
}
