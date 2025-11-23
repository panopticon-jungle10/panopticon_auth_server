import 'dotenv/config';
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
  }

  async onModuleInit() {
    this.logger.log(`[PRISMA] Connecting to database at: ${process.env.DATABASE_URL || 'DEFAULT'}`);
    try {
      await this.$connect();
      this.logger.log('[PRISMA] Successfully connected to database');
    } catch (err) {
      this.logger.error('[PRISMA] Connection failed', err as any);
      throw err;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting Prisma Client');
    try {
      await this.$disconnect();
    } catch (err) {
      // ignore
    }
  }
}
