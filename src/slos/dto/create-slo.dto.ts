import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateSloDto {
  @ApiProperty({
    example: 'product-api',
    description: '모니터링 대상 서비스명',
  })
  @IsString()
  serviceName!: string;

  @ApiProperty({
    example: '프로덕션 SLO',
    description: 'SLO 정책 이름',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 99.9,
    description: '가용성 목표값 (%)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  availabilityTarget?: number;

  @ApiProperty({
    example: 200,
    description: 'P95 레이턴시 목표값 (ms)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  latencyTargetMs?: number;

  @ApiProperty({
    example: 1.0,
    description: '에러율 목표값 (%)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  errorRateTarget?: number;

  @ApiProperty({
    example: true,
    description: '가용성 모니터링 활성화 여부',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  availabilityEnabled?: boolean;

  @ApiProperty({
    example: true,
    description: '레이턴시 모니터링 활성화 여부',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  latencyEnabled?: boolean;

  @ApiProperty({
    example: true,
    description: '에러율 모니터링 활성화 여부',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  errorRateEnabled?: boolean;

  @ApiProperty({
    example: '프로덕션 환경 SLO 설정',
    description: 'SLO 정책 설명',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
