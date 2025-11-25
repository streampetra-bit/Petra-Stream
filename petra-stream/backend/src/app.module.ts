import { Module } from '@nestjs/common';
import { StreamsModule } from './streams/streams.module';
import { IndexerModule } from './indexer/indexer.module';
import { NotificationsGateway } from './gateway/notifications.gateway';

@Module({
  imports: [StreamsModule, IndexerModule],
  providers: [NotificationsGateway]
})
export class AppModule {}
