import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookResponseDto } from './dto/webhook-response.dto';

@ApiTags('webhooks')
@Controller('api/webhooks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: '웹훅 설정 생성' })
  @ApiResponse({ status: 201, description: '웹훅이 생성됨', type: WebhookResponseDto })
  async create(@CurrentUser() user: any, @Body() dto: CreateWebhookDto): Promise<WebhookResponseDto> {
    return this.webhooksService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: '사용자의 모든 웹훅 설정 조회' })
  @ApiResponse({ status: 200, description: '웹훅 목록', type: [WebhookResponseDto] })
  async findAll(@CurrentUser() user: any): Promise<WebhookResponseDto[]> {
    return this.webhooksService.findAll(user.sub);
  }

  @Get(':webhookId')
  @ApiOperation({ summary: '특정 웹훅 설정 조회' })
  @ApiResponse({ status: 200, description: '웹훅 상세 정보', type: WebhookResponseDto })
  async findOne(
    @CurrentUser() user: any,
    @Param('webhookId') webhookId: string,
  ): Promise<WebhookResponseDto> {
    return this.webhooksService.findOne(user.sub, webhookId);
  }

  @Patch(':webhookId')
  @ApiOperation({ summary: '웹훅 설정 수정' })
  @ApiResponse({ status: 200, description: '웹훅이 수정됨', type: WebhookResponseDto })
  async update(
    @CurrentUser() user: any,
    @Param('webhookId') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ): Promise<WebhookResponseDto> {
    return this.webhooksService.update(user.sub, webhookId, dto);
  }

  @Delete(':webhookId')
  @ApiOperation({ summary: '웹훅 설정 삭제' })
  @ApiResponse({ status: 204, description: '웹훅이 삭제됨' })
  async delete(@CurrentUser() user: any, @Param('webhookId') webhookId: string): Promise<void> {
    return this.webhooksService.delete(user.sub, webhookId);
  }

  @Patch(':webhookId/toggle')
  @ApiOperation({ summary: '웹훅 활성화/비활성화 토글' })
  @ApiResponse({ status: 200, description: '토글 완료', type: WebhookResponseDto })
  async toggleEnabled(
    @CurrentUser() user: any,
    @Param('webhookId') webhookId: string,
  ): Promise<WebhookResponseDto> {
    return this.webhooksService.toggleEnabled(user.sub, webhookId);
  }

  @Post(':webhookId/test')
  @ApiOperation({ summary: '웹훅 테스트 발송' })
  @ApiResponse({ status: 200, description: '테스트 메시지 발송 완료' })
  async testWebhook(
    @CurrentUser() user: any,
    @Param('webhookId') webhookId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.webhooksService.testWebhook(user.sub, webhookId);
  }
}
