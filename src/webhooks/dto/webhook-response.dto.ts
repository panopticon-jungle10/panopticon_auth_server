import { ApiProperty } from '@nestjs/swagger';

export class WebhookResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  webhookUrl!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ required: false })
  smtpHost?: string;

  @ApiProperty({ required: false })
  smtpPort?: number;

  @ApiProperty({ required: false })
  smtpUser?: string;

  @ApiProperty({ required: false })
  smtpTls?: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false })
  lastTestedAt?: Date;
}
