import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SlosService } from './slos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSloDto } from './dto/create-slo.dto';
import { UpdateSloDto } from './dto/update-slo.dto';
import { SloResponseDto } from './dto/slo-response.dto';

@ApiTags('slos')
@Controller('api/slos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('jwt')
export class SlosController {
  constructor(private slosService: SlosService) {}

  @Post()
  @ApiOperation({ summary: 'SLO 정책 생성' })
  @ApiResponse({ status: 201, description: 'SLO 정책 생성됨', type: SloResponseDto })
  async create(@CurrentUser() user: any, @Body() dto: CreateSloDto): Promise<SloResponseDto> {
    return this.slosService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: '사용자의 모든 SLO 정책 조회' })
  @ApiResponse({ status: 200, description: 'SLO 정책 목록', type: [SloResponseDto] })
  async findAll(@CurrentUser() user: any): Promise<SloResponseDto[]> {
    return this.slosService.findAll(user.sub);
  }

  @Get(':sloId')
  @ApiOperation({ summary: '특정 SLO 정책 조회' })
  @ApiResponse({ status: 200, description: 'SLO 정책 상세 정보', type: SloResponseDto })
  async findOne(@CurrentUser() user: any, @Param('sloId') sloId: string): Promise<SloResponseDto> {
    return this.slosService.findOne(user.sub, sloId);
  }

  @Patch(':sloId')
  @ApiOperation({ summary: 'SLO 정책 수정' })
  @ApiResponse({ status: 200, description: 'SLO 정책 수정됨', type: SloResponseDto })
  async update(
    @CurrentUser() user: any,
    @Param('sloId') sloId: string,
    @Body() dto: UpdateSloDto,
  ): Promise<SloResponseDto> {
    return this.slosService.update(user.sub, sloId, dto);
  }

  @Delete(':sloId')
  @ApiOperation({ summary: 'SLO 정책 삭제' })
  @ApiResponse({ status: 204, description: 'SLO 정책 삭제됨' })
  async delete(@CurrentUser() user: any, @Param('sloId') sloId: string): Promise<void> {
    return this.slosService.delete(user.sub, sloId);
  }

  @Patch(':sloId/toggle')
  @ApiOperation({ summary: '메트릭 활성화/비활성화 토글' })
  @ApiResponse({ status: 200, description: '토글 완료', type: SloResponseDto })
  async toggleMetric(
    @CurrentUser() user: any,
    @Param('sloId') sloId: string,
    @Query('metric') metric: 'availability' | 'latency' | 'error_rate',
  ): Promise<SloResponseDto> {
    return this.slosService.toggleMetric(user.sub, sloId, metric);
  }

  @Post(':sloId/webhooks/:webhookId')
  @ApiOperation({ summary: 'SLO에 웹훅 추가' })
  @ApiResponse({ status: 201, description: '웹훅이 SLO에 추가됨' })
  async addWebhook(
    @CurrentUser() user: any,
    @Param('sloId') sloId: string,
    @Param('webhookId') webhookId: string,
  ): Promise<void> {
    return this.slosService.addWebhook(user.sub, sloId, webhookId);
  }

  @Delete(':sloId/webhooks/:webhookId')
  @ApiOperation({ summary: 'SLO에서 웹훅 제거' })
  @ApiResponse({ status: 204, description: '웹훅이 SLO에서 제거됨' })
  async removeWebhook(
    @CurrentUser() user: any,
    @Param('sloId') sloId: string,
    @Param('webhookId') webhookId: string,
  ): Promise<void> {
    return this.slosService.removeWebhook(user.sub, sloId, webhookId);
  }
}
