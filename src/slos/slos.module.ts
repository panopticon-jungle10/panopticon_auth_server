import { Module } from '@nestjs/common';
import { SlosService } from './slos.service';
import { SlosController } from './slos.controller';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '../jwt/jwt.service';

@Module({
  controllers: [SlosController],
  providers: [SlosService, PrismaService, JwtService],
})
export class SlosModule {}
