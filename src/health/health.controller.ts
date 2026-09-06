import { Controller, Get } from '@nestjs/common';
import { Public } from '../api/public.decorator';
import { HealthResponseDto } from './health.dto';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponseDto {
    return { status: 'ok' };
  }
}
