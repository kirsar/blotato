import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CurrentUserId } from '../current-user-id.decorator';
import { AutomationResponseDto, PutAutomationDto } from './automation.dto';
import { CommentAutomationService } from './comment-automation.service';
import { CompositionResponseDto, CreateCompositionDto } from './composition.dto';
import { CompositionService } from './composition.service';

@Controller('compositions')
export class CompositionController {
  constructor(
    private readonly compositions: CompositionService,
    private readonly commentAutomation: CommentAutomationService,
  ) {}

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

  // Idempotent 204, not the resulting state — GET is the one way to read it back
  // (2.api-surface.md).
  @Put(':id/automation')
  @HttpCode(204)
  async putAutomation(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: PutAutomationDto,
  ): Promise<void> {
    await this.commentAutomation.putAutomation(userId, id, dto);
  }

  @Delete(':id/automation')
  @HttpCode(204)
  async deleteAutomation(@CurrentUserId() userId: string, @Param('id') id: string): Promise<void> {
    await this.commentAutomation.deleteAutomation(userId, id);
  }

  @Get(':id/automation')
  async getAutomation(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<AutomationResponseDto> {
    return this.commentAutomation.getAutomation(userId, id);
  }
}
