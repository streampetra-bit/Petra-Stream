import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { StreamsModule } from './streams/streams.module';
import { IndexerModule } from './indexer/indexer.module';
import { UsersModule } from './users/users.module';
import { ChatGateway } from './gateway/chat.gateway';
import { MetaController } from './meta/meta.controller';
import { AuthController } from './auth/auth.controller';
import { HealthController } from './health/health.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60, limit: 120 }]
    }),
    StreamsModule,
    IndexerModule,
    UsersModule,
    NotificationsModule,
    WalletModule
  ],
  controllers: [MetaController, AuthController, HealthController],
  providers: [
    ChatGateway,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule {}
