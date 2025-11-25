import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min, IsArray, IsIn } from 'class-validator';

export class CreateSloDto {
  @ApiProperty({
    example: 'API 가용성 SLO',
    description: 'SLO 이름',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'user-service',
    description: '관련 서비스 이름',
    required: false,
  })
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiProperty({
    example: 'availability',
    description: '메트릭 타입: availability | latency | error_rate',
    enum: ['availability', 'latency', 'error_rate'],
  })
  @IsString()
  @IsIn(['availability', 'latency', 'error_rate'])
  metric!: string;

  @ApiProperty({
    example: 0.99,
    description: '목표값 (metric에 따라 다름: availability/error_rate는 0~1, latency는 ms)',
  })
  @IsNumber()
  @Min(0)
  target!: number;

  @ApiProperty({
    example: 0,
    description: 'SLI (Service Level Indicator) 값',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sliValue?: number;

  @ApiProperty({
    example: 0,
    description: '실제 다운타임 (분 단위)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualDowntimeMinutes?: number;

  @ApiProperty({
    example: 1440,
    description: '평가 기간 (분 단위: 60/1440/10080/43200)',
  })
  @IsNumber()
  @Min(60)
  totalMinutes!: number;

  @ApiProperty({
    example: ['slack', 'email'],
    description: '연결된 알림 채널 배열',
    required: false,
  })
  @IsOptional()
  @IsArray()
  connectedChannels?: string[];

  @ApiProperty({
    example: 'API 가용성을 99% 이상 유지하는 SLO',
    description: 'SLO 설명',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
