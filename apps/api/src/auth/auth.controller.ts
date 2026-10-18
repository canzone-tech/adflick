import { Body, Controller, Headers, Ip, Post, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(ip?: string, userAgent?: string) {
    return { ipAddress: ip, userAgent };
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.auth.login(dto.email, dto.password, this.meta(ip, userAgent));
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.auth.refresh(dto.refreshToken, this.meta(ip, userAgent));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Body() dto: LogoutDto, @CurrentUser() actor: AuthenticatedUser, @Ip() ip: string) {
    return this.auth.logout(dto.refreshToken, actor, this.meta(ip));
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
