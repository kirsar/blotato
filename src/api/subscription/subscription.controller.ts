import { Body, Controller, Delete, Get, NotImplementedException, Param, Post } from '@nestjs/common';
import { CreateSubscriptionDto } from './subscription.dto';

// Designed, not implemented (2.api-surface.md, "Subscriptions") — a well-formed 501
// proves routing and the error envelope work and states plainly the handler doesn't
// exist, rather than a 404 a caller can't distinguish from a typo. SSRF protection
// (address filtering, redirect re-checks, per-delivery timeouts) can't be deferred, so
// none of that exists here — this is routing and documentation only.
@Controller('subscriptions')
export class SubscriptionController {
  @Post()
  create(@Body() _dto: CreateSubscriptionDto): never {
    throw new NotImplementedException();
  }

  @Get()
  list(): never {
    throw new NotImplementedException();
  }

  @Get(':id')
  get(@Param('id') _id: string): never {
    throw new NotImplementedException();
  }

  @Delete(':id')
  remove(@Param('id') _id: string): never {
    throw new NotImplementedException();
  }
}
