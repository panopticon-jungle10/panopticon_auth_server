import { Module } from '@nestjs/common';
import { UsersController, HealthController } from './users.controller';
import { UsersService } from './users.service';
import { JwtService } from '../jwt/jwt.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [UsersController, HealthController],
  providers: [UsersService, PrismaService, JwtService],
  exports: [UsersService],
})
export class UsersModule {}