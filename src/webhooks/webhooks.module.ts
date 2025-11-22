import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '../jwt/jwt.service';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, PrismaService, JwtService],
})
export class WebhooksModule {}
