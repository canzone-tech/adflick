import { Controller, Get, Headers, Param, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { DeliveryService } from './delivery.service';

@Controller('devices/:id')
@UseGuards(ThrottlerGuard)
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}
  @Get('manifest')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  manifest(@Param('id') id: string, @Headers('x-device-secret') secret: string) {
    return this.delivery.getManifest(id, secret);
  }
}
