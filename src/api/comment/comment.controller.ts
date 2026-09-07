import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotImplementedException,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { CurrentUserId } from '../current-user-id.decorator';
import { CommentListResponseDto, CommentListQueryDto } from './comment-list.dto';
import { CommentResponseDto, CreateCommentDto } from './comment.dto';
import { CommentIdempotencyInterceptor } from './comment-idempotency.interceptor';

@Controller('comments')
export class CommentController {
  constructor(private readonly comments: CommentService) {}

  @Get()
  async getAll(
    @CurrentUserId() userId: string,
    @Query() query: CommentListQueryDto,
  ): Promise<CommentListResponseDto> {
    return this.comments.list(userId, query);
  }

  @Get(':id')
  async get(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ): Promise<CommentResponseDto> {
    return this.comments.findById(userId, id);
  }

  @Post()
  @UseInterceptors(CommentIdempotencyInterceptor)
  @HttpCode(201)
  async create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.comments.create(userId, dto);
  }

  // Designed — not implemented: marks the comment for deletion, processed
  // asynchronously by the worker, same as a reply.
  @Delete(':id')
  remove(): never {
    throw new NotImplementedException();
  }
}
