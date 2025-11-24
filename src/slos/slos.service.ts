import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSloDto } from './dto/create-slo.dto';
import { UpdateSloDto } from './dto/update-slo.dto';
import { SloResponseDto } from './dto/slo-response.dto';

@Injectable()
export class SlosService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSloDto): Promise<SloResponseDto> {
    try {
      const slo = await this.prisma.sloPolicy.create({
        data: {
          userId,
          name: dto.name,
          metric: dto.metric,
          target: dto.target,
          sliValue: dto.sliValue ?? 0,
          actualDowntimeMinutes: dto.actualDowntimeMinutes ?? 0,
          totalMinutes: dto.totalMinutes,
          connectedChannels: dto.connectedChannels ?? [],
          description: dto.description,
        },
      });

      return this.mapToResponseDto(slo);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `SLO policy with name "${dto.name}" already exists`,
        );
      }
      throw new BadRequestException(err?.message || 'Failed to create SLO policy');
    }
  }

  async findAll(userId: string): Promise<SloResponseDto[]> {
    console.log(`[FIND ALL] userId: ${userId}`);

    const slos = await this.prisma.sloPolicy.findMany({
      where: { userId },
      include: { webhookMappings: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[FIND ALL] Found ${slos.length} SLOs:`, slos.map(s => ({ id: s.id, userId: s.userId })));

    return Promise.all(slos.map((slo: any) => this.mapToResponseDtoWithWebhooks(slo)));
  }

  async findOne(userId: string, sloId: string): Promise<SloResponseDto> {
    const slo = await this.prisma.sloPolicy.findUnique({
      where: { id: sloId },
      include: { webhookMappings: true },
    });

    if (!slo || slo.userId !== userId) {
      throw new NotFoundException(`SLO policy with ID "${sloId}" not found`);
    }

    return this.mapToResponseDtoWithWebhooks(slo);
  }

  async update(userId: string, sloId: string, dto: UpdateSloDto): Promise<SloResponseDto> {
    // Verify ownership
    const existing = await this.prisma.sloPolicy.findUnique({ where: { id: sloId } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException(`SLO policy with ID "${sloId}" not found`);
    }

    try {
      const updateData: any = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.metric !== undefined) updateData.metric = dto.metric;
      if (dto.target !== undefined) updateData.target = dto.target;
      if (dto.sliValue !== undefined) updateData.sliValue = dto.sliValue;
      if (dto.actualDowntimeMinutes !== undefined) updateData.actualDowntimeMinutes = dto.actualDowntimeMinutes;
      if (dto.totalMinutes !== undefined) updateData.totalMinutes = dto.totalMinutes;
      if (dto.connectedChannels !== undefined) updateData.connectedChannels = dto.connectedChannels;
      if (dto.description !== undefined) updateData.description = dto.description;

      const slo = await this.prisma.sloPolicy.update({
        where: { id: sloId },
        data: updateData,
      });

      return this.mapToResponseDto(slo);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `SLO policy with name "${dto.name}" already exists`,
        );
      }
      throw new BadRequestException(err?.message || 'Failed to update SLO policy');
    }
  }

  async delete(userId: string, sloId: string): Promise<void> {
    console.log(`[DELETE SLO] userId: ${userId}, sloId: ${sloId}`);

    const slo = await this.prisma.sloPolicy.findUnique({ where: { id: sloId } });
    console.log(`[DELETE SLO] Found SLO:`, slo ? { id: slo.id, userId: slo.userId } : 'NOT FOUND');
    console.log(`[DELETE SLO] userId match: ${slo?.userId} === ${userId} ? ${slo?.userId === userId}`);

    if (!slo || slo.userId !== userId) {
      console.log(`[DELETE SLO] Authorization failed - throwing NotFoundException`);
      throw new NotFoundException(`SLO policy with ID "${sloId}" not found`);
    }

    console.log(`[DELETE SLO] Deleting SLO with ID: ${sloId}`);
    await this.prisma.sloPolicy.delete({ where: { id: sloId } });
    console.log(`[DELETE SLO] Successfully deleted SLO with ID: ${sloId}`);
  }

  // Note: toggleMetric is no longer needed with the new schema since each SLO has a single metric
  // Keeping this method for backwards compatibility if needed
  async toggleMetric(
    userId: string,
    sloId: string,
    metric: 'availability' | 'latency' | 'error_rate',
  ): Promise<SloResponseDto> {
    const slo = await this.prisma.sloPolicy.findUnique({ where: { id: sloId } });
    if (!slo || slo.userId !== userId) {
      throw new NotFoundException(`SLO policy with ID "${sloId}" not found`);
    }

    // With the new schema, SLOs have a single metric, so toggling would just delete and recreate
    // For now, just return the existing SLO
    return this.mapToResponseDto(slo);
  }

  async addWebhook(userId: string, sloId: string, webhookId: string): Promise<void> {
    const slo = await this.prisma.sloPolicy.findUnique({ where: { id: sloId } });
    if (!slo || slo.userId !== userId) {
      throw new NotFoundException(`SLO policy with ID "${sloId}" not found`);
    }

    const webhook = await this.prisma.webhookConfig.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.userId !== userId) {
      throw new NotFoundException(`Webhook with ID "${webhookId}" not found`);
    }

    try {
      await this.prisma.sloWebhookMapping.create({
        data: { sloId, webhookId },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException('This webhook is already connected to this SLO');
      }
      throw err;
    }
  }

  async removeWebhook(userId: string, sloId: string, webhookId: string): Promise<void> {
    const slo = await this.prisma.sloPolicy.findUnique({ where: { id: sloId } });
    if (!slo || slo.userId !== userId) {
      throw new NotFoundException(`SLO policy with ID "${sloId}" not found`);
    }

    await this.prisma.sloWebhookMapping.deleteMany({
      where: { sloId, webhookId },
    });
  }

  private mapToResponseDto(slo: any): SloResponseDto {
    return {
      id: slo.id,
      userId: slo.userId,
      name: slo.name,
      metric: slo.metric,
      target: slo.target,
      sliValue: slo.sliValue,
      actualDowntimeMinutes: slo.actualDowntimeMinutes,
      totalMinutes: slo.totalMinutes,
      connectedChannels: slo.connectedChannels,
      description: slo.description,
      createdAt: slo.createdAt,
      updatedAt: slo.updatedAt,
    };
  }

  private async mapToResponseDtoWithWebhooks(slo: any): Promise<SloResponseDto> {
    // webhookMappings are no longer returned in the response
    // connectedChannels are already included in the SLO
    return this.mapToResponseDto(slo);
  }
}
