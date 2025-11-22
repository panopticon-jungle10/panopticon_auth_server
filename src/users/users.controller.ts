import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
  Param,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtService } from '../jwt/jwt.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpsertUserDto } from './dto/upsert-user.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UpsertResponseDto } from './dto/upsert-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService, private jwtService: JwtService) {}

  @Post()
  @ApiOperation({ summary: 'Upsert user (requires Authorization Bearer token)' })
  @ApiBearerAuth('jwt')
  @ApiResponse({ status: 200, description: 'User upserted', type: UpsertResponseDto })
  async upsertUser(@Body() body: UpsertUserDto, @Headers('authorization') auth?: string) {
    if (!auth || !auth.startsWith('Bearer ')) throw new UnauthorizedException('Missing Authorization');
    const token = auth.replace(/^Bearer /, '');
    const { valid } = await this.jwtService.verify(token);
    if (!valid) throw new UnauthorizedException('Invalid token');

    try {
      const user = await this.usersService.upsert(body);
      return { success: true, user };
    } catch (err: any) {
      // UsersService throws BadRequestException for client errors
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err?.message || 'Failed to upsert user');
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '현재 사용자 정보 조회' })
  @ApiResponse({ status: 200, description: 'User information', type: UserResponseDto })
  async getMe(@CurrentUser() user: any): Promise<UserResponseDto> {
    try {
      const userInfo = await this.usersService.getUserInfo(user.sub);
      return this.mapToResponseDto(userInfo);
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Failed to fetch user info');
    }
  }

  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '특정 사용자 정보 조회' })
  @ApiResponse({ status: 200, description: 'User information', type: UserResponseDto })
  async getUser(@Param('userId') userId: string, @CurrentUser() user: any): Promise<UserResponseDto> {
    // Users can only view their own profile (or admins can view others)
    if (user.sub !== userId) {
      throw new UnauthorizedException('You can only view your own profile');
    }

    try {
      const userInfo = await this.usersService.getUserInfo(userId);
      return this.mapToResponseDto(userInfo);
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Failed to fetch user info');
    }
  }

  @Patch(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: '사용자 정보 수정' })
  @ApiResponse({ status: 200, description: 'User updated', type: UserResponseDto })
  async updateUser(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    // Users can only update their own profile
    if (user.sub !== userId) {
      throw new UnauthorizedException('You can only update your own profile');
    }

    try {
      const updated = await this.usersService.updateUserInfo(userId, dto);
      return this.mapToResponseDto(updated);
    } catch (err: any) {
      throw new BadRequestException(err?.message || 'Failed to update user info');
    }
  }

  private mapToResponseDto(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      role: user.role,
      provider: user.oauthAccounts?.[0]?.provider || null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'panopticon-auth-server' };
  }

  @Get('auth/health')
  authHealth() {
    return this.health();
  }
}
