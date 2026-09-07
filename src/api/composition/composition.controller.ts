import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUserId } from '../current-user-id.decorator';
import { CompositionResponseDto, CreateCompositionDto } from './composition.dto';
import { CompositionService } from './composition.service';

@Controller('compositions')
export class CompositionController {
  constructor(private readonly compositions: CompositionService) {}

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateCompositionDto,
  ): Promise<CompositionResponseDto> {
    return this.compositions.create(userId, dto);
  }

  @Get(':id')
  async get(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<CompositionResponseDto> {
    return this.compositions.findById(userId, id);
  }
}
