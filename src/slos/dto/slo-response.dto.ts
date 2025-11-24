import { ApiProperty } from '@nestjs/swagger';

export class SloResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    enum: ['availability', 'latency', 'error_rate'],
    description: '메트릭 타입',
  })
  metric!: string;

  @ApiProperty()
  target!: number;

  @ApiProperty()
  sliValue!: number;

  @ApiProperty()
  actualDowntimeMinutes!: number;

  @ApiProperty()
  totalMinutes!: number;

  @ApiProperty({
    type: [String],
    description: '연결된 알림 채널 배열',
  })
  connectedChannels!: string[];

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
