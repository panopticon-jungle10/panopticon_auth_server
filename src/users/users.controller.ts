import { Controller, Post, Body, Headers, UnauthorizedException, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtService } from '../jwt/jwt.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService, private jwtService: JwtService) {}

  @Post()
  async upsertUser(@Body() body: any, @Headers('authorization') auth?: string) {
    if (!auth || !auth.startsWith('Bearer ')) throw new UnauthorizedException('Missing Authorization');
    const token = auth.replace(/^Bearer /, '');
    const { valid } = await this.jwtService.verify(token);
    if (!valid) throw new UnauthorizedException('Invalid token');

    const user = await this.usersService.upsert(body);
    return { success: true, user };
  }
}

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'panopticon-auth-server' };
  }
}
