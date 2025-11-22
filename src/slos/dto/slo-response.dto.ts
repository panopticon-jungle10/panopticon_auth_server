import { ApiProperty } from '@nestjs/swagger';

export class SloResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  serviceName!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  availabilityTarget!: number;

  @ApiProperty()
  latencyTargetMs!: number;

  @ApiProperty()
  errorRateTarget!: number;

  @ApiProperty()
  availabilityEnabled!: boolean;

  @ApiProperty()
  latencyEnabled!: boolean;

  @ApiProperty()
  errorRateEnabled!: boolean;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({
    type: [String],
    description: 'SLO에 연결된 웹훅 ID 목록',
  })
  webhookIds?: string[];
}
