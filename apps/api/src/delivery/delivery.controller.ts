import { Controller, Get, Header, Headers, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { DeliveryService } from './delivery.service';

@Controller('devices/:id')
@UseGuards(ThrottlerGuard)
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}
  // Non-mutating, device-authenticated discovery for TV/desktop/mobile clients.
  // Version negotiation is independent of the existing manifest v1 response.
  @Get('protocol')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  protocol(
    @Param('id') id: string,
    @Headers('x-device-secret') secret: string,
    @Query('version') version?: string,
  ) {
    return this.delivery.getProtocol(id, secret, version);
  }

  @Get('manifest')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  manifest(@Param('id') id: string, @Headers('x-device-secret') secret: string) {
    return this.delivery.getManifest(id, secret);
  }
}
