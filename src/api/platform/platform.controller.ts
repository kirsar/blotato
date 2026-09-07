import { Controller, Get } from '@nestjs/common';
import { PlatformId } from '@domain/platform-id';
import { PLATFORMS } from '@platforms/registry';
import { PlatformResponseDto, toPlatformResponse } from './platform.dto';

@Controller('platforms')
export class PlatformController {
  @Get()
  getAll(): PlatformResponseDto[] {
    return (Object.keys(PLATFORMS) as PlatformId[]).map((id) => toPlatformResponse(id, PLATFORMS[id]));
  }
}
