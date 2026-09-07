import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotImplementedException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateSubscriptionDto } from './subscription.dto';

// Designed, not implemented (2.api-surface.md, "Subscriptions") — a well-formed 501
// proves routing and the error envelope work and states plainly the handler doesn't
// exist, rather than a 404 a caller can't distinguish from a typo. SSRF protection
// (address filtering, redirect re-checks, per-delivery timeouts) can't be deferred, so
// none of that exists here — this is routing and documentation only.
//
// @HttpCode(501) is load-bearing for the *document*, not the response: the thrown
// NotImplementedException already sets the status. Without it the Swagger plugin infers
// the framework default — 201 for POST, 200 for the rest — so a generated client would
// carry a success contract that can never happen, which is the opposite of stating
// plainly that the handler doesn't exist.
const NOT_IMPLEMENTED = {
  status: 501,
  description: 'Designed, not implemented. Standard error envelope with code NOT_IMPLEMENTED.',
} as const;

@ApiTags('Designed — not implemented')
@Controller('subscriptions')
export class SubscriptionController {
  @Post()
  @HttpCode(501)
  @ApiResponse(NOT_IMPLEMENTED)
  create(@Body() _dto: CreateSubscriptionDto): never {
    throw new NotImplementedException();
  }

  @Get()
  @HttpCode(501)
  @ApiResponse(NOT_IMPLEMENTED)
  list(): never {
    throw new NotImplementedException();
  }

  @Get(':id')
  @HttpCode(501)
  @ApiResponse(NOT_IMPLEMENTED)
  get(@Param('id') _id: string): never {
    throw new NotImplementedException();
  }

  @Delete(':id')
  @HttpCode(501)
  @ApiResponse(NOT_IMPLEMENTED)
  remove(@Param('id') _id: string): never {
    throw new NotImplementedException();
  }
}
