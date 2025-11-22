import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, ValidateIf, IsEmail } from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty({
    enum: ['slack', 'discord', 'teams', 'email'],
    description: '웹훅 타입',
  })
  @IsString()
  type!: 'slack' | 'discord' | 'teams' | 'email';

  @ApiProperty({
    example: '팀 알림 채널',
    description: '웹훅 이름',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'https://hooks.slack.com/services/...',
    description: '웹훅 URL (Slack/Discord/Teams) 또는 이메일 주소',
  })
  @IsString()
  webhookUrl!: string;

  // Email SMTP 설정
  @ApiProperty({
    example: 'smtp.gmail.com',
    description: 'SMTP 호스트 (이메일 타입에만 필수)',
    required: false,
  })
  @ValidateIf((obj) => obj.type === 'email')
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiProperty({
    example: 587,
    description: 'SMTP 포트 (이메일 타입에만 필수)',
    required: false,
  })
  @ValidateIf((obj) => obj.type === 'email')
  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @ApiProperty({
    example: 'sender@gmail.com',
    description: 'SMTP 사용자명 (이메일 타입에만 필수)',
    required: false,
  })
  @ValidateIf((obj) => obj.type === 'email')
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiProperty({
    example: 'app-password',
    description: 'SMTP 비밀번호 (이메일 타입에만 필수)',
    required: false,
  })
  @ValidateIf((obj) => obj.type === 'email')
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiProperty({
    example: true,
    description: 'SMTP TLS 사용 여부 (이메일 타입에만 필수)',
    required: false,
  })
  @ValidateIf((obj) => obj.type === 'email')
  @IsOptional()
  @IsBoolean()
  smtpTls?: boolean;
}
