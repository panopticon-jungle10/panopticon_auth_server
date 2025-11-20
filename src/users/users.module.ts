import { Module } from '@nestjs/common';
import { UsersController, HealthController } from './users.controller';
import { UsersService } from './users.service';
import { DbService } from '../db/db.service';
import { JwtService } from '../jwt/jwt.service';

@Module({
  controllers: [UsersController, HealthController],
  providers: [UsersService, DbService, JwtService],
})
export class UsersModule {}