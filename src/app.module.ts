import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SlosModule } from './slos/slos.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [UsersModule, AuthModule, SlosModule, WebhooksModule],
})
export class AppModule {}
