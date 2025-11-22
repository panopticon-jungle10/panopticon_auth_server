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
          serviceName: dto.serviceName,
          name: dto.name,
          availabilityTarget: dto.availabilityTarget ?? 99.9,
          latencyTargetMs: dto.latencyTargetMs ?? 200,
          errorRateTarget: dto.errorRateTarget ?? 1.0,
          availabilityEnabled: dto.availabilityEnabled ?? true,
          latencyEnabled: dto.latencyEnabled ?? true,
          errorRateEnabled: dto.errorRateEnabled ?? true,
          description: dto.description,
        },
      });

      return this.mapToResponseDto(slo);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `SLO policy with name "${dto.name}" for service "${dto.serviceName}" already exists`,
        );
      }
      throw new BadRequestException(err?.message || 'Failed to create SLO policy');
    }
  }

  async findAll(userId: string): Promise<SloResponseDto[]> {
    const slos = await this.prisma.sloPolicy.findMany({
      where: { userId },
      include: { webhookMappings: true },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(slos.map(slo => this.mapToResponseDtoWithWebhooks(slo)));
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
      const slo = await this.prisma.sloPolicy.update({
        where: { id: sloId },
        data: {
          serviceName: dto.serviceName,
          name: dto.name,
          availabilityTarget: dto.availabilityTarget,
          latencyTargetMs: dto.latencyTargetMs,
          errorRateTarget: dto.errorRateTarget,
          availabilityEnabled: dto.availabilityEnabled,
          latencyEnabled: dto.latencyEnabled,
          errorRateEnabled: dto.errorRateEnabled,
          description: dto.description,
        },
      });

      return this.mapToResponseDto(slo);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException(
          `SLO policy with name "${dto.name}" for service "${dto.serviceName}" already exists`,
        );
      }
      throw new BadRequestException(err?.message || 'Failed to update SLO policy');
    }
  }

  async delete(userId: string, sloId: string): Promise<void> {
    const slo = await this.prisma.sloPolicy.findUnique({ where: { id: sloId } });
    if (!slo || slo.userId !== userId) {
      throw new NotFoundException(`SLO policy with ID "${sloId}" not found`);
    }

    await this.prisma.sloPolicy.delete({ where: { id: sloId } });
  }

  async toggleMetric(
    userId: string,
    sloId: string,
    metric: 'availability' | 'latency' | 'error_rate',
  ): Promise<SloResponseDto> {
    const slo = await this.prisma.sloPolicy.findUnique({ where: { id: sloId } });
    if (!slo || slo.userId !== userId) {
      throw new NotFoundException(`SLO policy with ID "${sloId}" not found`);
    }

    const updateData: any = {};
    switch (metric) {
      case 'availability':
        updateData.availabilityEnabled = !slo.availabilityEnabled;
        break;
      case 'latency':
        updateData.latencyEnabled = !slo.latencyEnabled;
        break;
      case 'error_rate':
        updateData.errorRateEnabled = !slo.errorRateEnabled;
        break;
      default:
        throw new BadRequestException(`Invalid metric: ${metric}`);
    }

    const updated = await this.prisma.sloPolicy.update({
      where: { id: sloId },
      data: updateData,
    });

    return this.mapToResponseDto(updated);
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
      serviceName: slo.serviceName,
      name: slo.name,
      availabilityTarget: slo.availabilityTarget,
      latencyTargetMs: slo.latencyTargetMs,
      errorRateTarget: slo.errorRateTarget,
      availabilityEnabled: slo.availabilityEnabled,
      latencyEnabled: slo.latencyEnabled,
      errorRateEnabled: slo.errorRateEnabled,
      description: slo.description,
      createdAt: slo.createdAt,
      updatedAt: slo.updatedAt,
    };
  }

  private async mapToResponseDtoWithWebhooks(slo: any): Promise<SloResponseDto> {
    const webhookIds = slo.webhookMappings?.map((m: any) => m.webhookId) || [];
    return {
      ...this.mapToResponseDto(slo),
      webhookIds,
    };
  }
}
