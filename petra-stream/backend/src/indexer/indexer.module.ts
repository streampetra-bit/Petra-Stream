import { Module } from '@nestjs/common';
import { BlockIndexerService } from './block-indexer.service';
import { StreamsModule } from '../streams/streams.module';
import { NotificationsGateway } from '../gateway/notifications.gateway';

@Module({
  imports: [StreamsModule],
  providers: [BlockIndexerService, NotificationsGateway],
  exports: [BlockIndexerService]
})
export class IndexerModule {}
