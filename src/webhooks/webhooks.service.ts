import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookResponseDto } from './dto/webhook-response.dto';
import axios from 'axios';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateWebhookDto): Promise<WebhookResponseDto> {
    // Validate webhook URL based on type
    this.validateWebhookUrl(dto.type, dto.webhookUrl);

    // For email type, validate SMTP settings
    if (dto.type === 'email') {
      if (!dto.smtpHost || !dto.smtpPort || !dto.smtpUser || !dto.smtpPassword) {
        throw new BadRequestException(
          'For email webhooks, smtpHost, smtpPort, smtpUser, and smtpPassword are required',
        );
      }
    }

    try {
      const webhook = await this.prisma.webhookConfig.create({
        data: {
          userId,
          type: dto.type,
          name: dto.name,
          webhookUrl: dto.webhookUrl,
          smtpHost: dto.smtpHost,
          smtpPort: dto.smtpPort,
          smtpUser: dto.smtpUser,
          smtpPassword: dto.smtpPassword,
          smtpTls: dto.smtpTls,
        },
      });

      return this.mapToResponseDto(webhook);
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Failed to create webhook');
    }
  }

  async findAll(userId: string): Promise<WebhookResponseDto[]> {
    const webhooks = await this.prisma.webhookConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map((webhook: any) => this.mapToResponseDto(webhook));
  }

  async findOne(userId: string, webhookId: string): Promise<WebhookResponseDto> {
    const webhook = await this.prisma.webhookConfig.findUnique({
      where: { id: webhookId },
    });

    if (!webhook || webhook.userId !== userId) {
      throw new NotFoundException(`Webhook with ID "${webhookId}" not found`);
    }

    return this.mapToResponseDto(webhook);
  }

  async update(userId: string, webhookId: string, dto: UpdateWebhookDto): Promise<WebhookResponseDto> {
    // Verify ownership
    const existing = await this.prisma.webhookConfig.findUnique({
      where: { id: webhookId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException(`Webhook with ID "${webhookId}" not found`);
    }

    // Validate if type or URL is being changed
    if (dto.type) {
      this.validateWebhookUrl(dto.type, dto.webhookUrl || existing.webhookUrl);
    }

    // Validate SMTP settings for email type
    if (dto.type === 'email' || existing.type === 'email') {
      const finalType = dto.type || existing.type;
      if (finalType === 'email') {
        const smtpHost = dto.smtpHost || existing.smtpHost;
        const smtpPort = dto.smtpPort || existing.smtpPort;
        const smtpUser = dto.smtpUser || existing.smtpUser;
        const smtpPassword = dto.smtpPassword || existing.smtpPassword;

        if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
          throw new BadRequestException(
            'For email webhooks, smtpHost, smtpPort, smtpUser, and smtpPassword are required',
          );
        }
      }
    }

    try {
      const webhook = await this.prisma.webhookConfig.update({
        where: { id: webhookId },
        data: {
          type: dto.type,
          name: dto.name,
          webhookUrl: dto.webhookUrl,
          smtpHost: dto.smtpHost,
          smtpPort: dto.smtpPort,
          smtpUser: dto.smtpUser,
          smtpPassword: dto.smtpPassword,
          smtpTls: dto.smtpTls,
        },
      });

      return this.mapToResponseDto(webhook);
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Failed to update webhook');
    }
  }

  async delete(userId: string, webhookId: string): Promise<void> {
    const webhook = await this.prisma.webhookConfig.findUnique({
      where: { id: webhookId },
    });
    if (!webhook || webhook.userId !== userId) {
      throw new NotFoundException(`Webhook with ID "${webhookId}" not found`);
    }

    await this.prisma.webhookConfig.delete({ where: { id: webhookId } });
  }

  async toggleEnabled(userId: string, webhookId: string): Promise<WebhookResponseDto> {
    const webhook = await this.prisma.webhookConfig.findUnique({
      where: { id: webhookId },
    });
    if (!webhook || webhook.userId !== userId) {
      throw new NotFoundException(`Webhook with ID "${webhookId}" not found`);
    }

    const updated = await this.prisma.webhookConfig.update({
      where: { id: webhookId },
      data: { enabled: !webhook.enabled },
    });

    return this.mapToResponseDto(updated);
  }

  async testWebhook(userId: string, webhookId: string): Promise<{ success: boolean; message: string }> {
    const webhook = await this.prisma.webhookConfig.findUnique({
      where: { id: webhookId },
    });
    if (!webhook || webhook.userId !== userId) {
      throw new NotFoundException(`Webhook with ID "${webhookId}" not found`);
    }

    try {
      if (webhook.type === 'email') {
        // For email, we would normally send via SMTP, but for now just validate settings
        if (!webhook.smtpHost || !webhook.smtpPort || !webhook.smtpUser || !webhook.smtpPassword) {
          throw new Error('SMTP settings are incomplete');
        }
        // In production, you would use nodemailer or similar to actually send
        // For now, just validate that we can connect
        const message = 'Test email configuration validated (actual sending requires SMTP implementation)';
        await this.updateLastTestedAt(webhookId);
        return { success: true, message };
      } else if (webhook.type === 'slack') {
        // Slack webhook payload format
        const slackPayload = {
          text: 'Test message from Panopticon',
          attachments: [
            {
              color: '#36a64f',
              title: 'Panopticon Webhook Test',
              text: 'This is a test message to verify your Slack webhook is working correctly.',
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        };
        await axios.post(webhook.webhookUrl, slackPayload, {
          timeout: 5000,
        });
        await this.updateLastTestedAt(webhookId);
        return { success: true, message: 'Test message sent to Slack successfully' };
      } else if (webhook.type === 'discord') {
        // Discord webhook payload format
        const discordPayload = {
          content: 'Test message from Panopticon',
          embeds: [
            {
              color: 0x3394ff, // Use hex notation instead of decimal
              title: 'Panopticon Webhook Test',
              description: 'This is a test message to verify your Discord webhook is working correctly.',
              timestamp: new Date().toISOString(),
            },
          ],
        };
        await axios.post(webhook.webhookUrl, discordPayload, {
          timeout: 5000,
        });
        await this.updateLastTestedAt(webhookId);
        return { success: true, message: 'Test message sent to Discord successfully' };
      } else if (webhook.type === 'teams') {
        // Microsoft Teams webhook payload format (MessageCard)
        const teamsPayload = {
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          themeColor: '36a64f',
          summary: 'Panopticon Webhook Test',
          sections: [
            {
              activityTitle: 'Panopticon Webhook Test',
              activitySubtitle: 'Test notification',
              text: 'This is a test message to verify your Teams webhook is working correctly.',
            },
          ],
        };
        await axios.post(webhook.webhookUrl, teamsPayload, {
          timeout: 5000,
        });
        await this.updateLastTestedAt(webhookId);
        return { success: true, message: 'Test message sent to Teams successfully' };
      } else {
        throw new Error(`Unknown webhook type: ${webhook.type}`);
      }
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to send test message: ${err?.message || 'Unknown error'}`,
      );
    }
  }

  private async updateLastTestedAt(webhookId: string): Promise<void> {
    await this.prisma.webhookConfig.update({
      where: { id: webhookId },
      data: { lastTestedAt: new Date() },
    });
  }

  private validateWebhookUrl(type: string, url: string): void {
    if (!url) {
      throw new BadRequestException('webhookUrl is required');
    }

    const isValidUrl = (str: string) => {
      try {
        new URL(str);
        return true;
      } catch {
        return false;
      }
    };

    switch (type) {
      case 'slack':
        if (!url.startsWith('https://hooks.slack.com/services/')) {
          throw new BadRequestException(
            'Invalid Slack webhook URL. Must start with https://hooks.slack.com/services/',
          );
        }
        break;
      case 'discord':
        if (!url.startsWith('https://discord.com/api/webhooks/') && !url.startsWith('https://discordapp.com/api/webhooks/')) {
          throw new BadRequestException(
            'Invalid Discord webhook URL. Must start with https://discord.com/api/webhooks/',
          );
        }
        break;
      case 'teams':
        if (!isValidUrl(url)) {
          throw new BadRequestException('Invalid Teams webhook URL');
        }
        break;
      case 'email':
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(url)) {
          throw new BadRequestException('Invalid email address');
        }
        break;
      default:
        throw new BadRequestException(`Unknown webhook type: ${type}`);
    }
  }

  private mapToResponseDto(webhook: any): WebhookResponseDto {
    const dto: WebhookResponseDto = {
      id: webhook.id,
      userId: webhook.userId,
      type: webhook.type,
      name: webhook.name,
      webhookUrl: webhook.webhookUrl,
      enabled: webhook.enabled,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      lastTestedAt: webhook.lastTestedAt,
    };

    if (webhook.type === 'email') {
      dto.smtpHost = webhook.smtpHost;
      dto.smtpPort = webhook.smtpPort;
      dto.smtpUser = webhook.smtpUser;
      dto.smtpTls = webhook.smtpTls;
      // Don't return password for security
    }

    return dto;
  }
}
