import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { StreamsModule } from './streams/streams.module';
import { IndexerModule } from './indexer/indexer.module';
import { NotificationsGateway } from './gateway/notifications.gateway';
import { UsersModule } from './users/users.module';
import { ChatGateway } from './gateway/chat.gateway';
import { MetaController } from './meta/meta.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { AuthController } from './auth/auth.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 120
    }),
    StreamsModule,
    IndexerModule,
    UsersModule
  ],
  controllers: [MetaController, NotificationsController, AuthController, HealthController],
  providers: [
    NotificationsGateway,
    ChatGateway,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
